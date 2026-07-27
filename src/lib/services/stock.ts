import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  auditLogs, blockTestProfileItems, deliveries, deliveryBatches, inventoryLots,
  processingOutputs, processingSessions, projectedYields, stockLedgerEntries,
} from "@/lib/db/schema";
import { assertCanConsume, reconcileProcessing } from "@/lib/inventory";
import { authorize, type AppRole } from "@/lib/auth";

type ReceiveInput = {
  supplierId: string; invoiceNumber: string; deliveryDate: string; meatType: string;
  unitCount?: number; invoiceWeightKg: number; actualWeightKg: number; costPerKg: number;
  notes?: string; rawProductId: string; profileId: string; userId: string; userRole: AppRole;
};

export async function receiveDelivery(input: ReceiveInput) {
  authorize(input.userRole, "receive:delivery");
  if (input.actualWeightKg <= 0 || input.costPerKg < 0) throw new Error("Invalid delivery quantities");
  const db = getDb();
  return db.transaction(async (tx) => {
    const [delivery] = await tx.insert(deliveries).values({
      supplierId: input.supplierId, invoiceNumber: input.invoiceNumber,
      deliveryDate: input.deliveryDate, meatType: input.meatType, unitCount: input.unitCount,
      invoiceWeightKg: String(input.invoiceWeightKg), actualWeightKg: String(input.actualWeightKg),
      costPerKg: String(input.costPerKg), totalCost: String(input.actualWeightKg * input.costPerKg),
      notes: input.notes, createdBy: input.userId,
    }).returning();
    const day = input.deliveryDate.replaceAll("-", "");
    const count = await tx.$count(deliveryBatches);
    const code = `BF-${day}-${String(count + 1).padStart(3, "0")}`;
    const [batch] = await tx.insert(deliveryBatches).values({
      code, deliveryId: delivery.id, rawProductId: input.rawProductId, profileId: input.profileId,
      receivedWeightKg: String(input.actualWeightKg), remainingRawKg: String(input.actualWeightKg),
    }).returning();
    const profileItems = await tx.select().from(blockTestProfileItems).where(eq(blockTestProfileItems.profileId, input.profileId));
    await tx.insert(projectedYields).values(profileItems.map((item) => ({
      batchId: batch.id, productId: item.productId, profilePercent: item.yieldPercent,
      expectedWeightKg: String(input.actualWeightKg * Number(item.yieldPercent) / 100),
    })));
    await tx.insert(inventoryLots).values({
      productId: input.rawProductId, batchId: batch.id, location: "RAW_COOLER",
      physicalKg: String(input.actualWeightKg), reservedKg: "0", unitCostKg: String(input.costPerKg),
    });
    await tx.insert(stockLedgerEntries).values({
      transactionId: `RCV-${delivery.id.slice(0, 8)}`, productId: input.rawProductId, batchId: batch.id,
      quantityKg: String(input.actualWeightKg), direction: "IN", movementType: "SUPPLIER_RECEIPT",
      source: input.supplierId, destination: "RAW_COOLER", reason: "Supplier delivery",
      relatedEntityType: "Delivery", relatedEntityId: delivery.id, userId: input.userId,
    });
    await tx.insert(auditLogs).values({ userId: input.userId, action: "DELIVERY_CREATED", entityType: "Delivery", entityId: delivery.id, newValues: delivery });
    return { delivery, batch };
  });
}

type ProcessInput = {
  batchId: string; inputWeightKg: number; outputs: { productId: string; expectedKg: number; actualKg: number }[];
  lossKg: number; lossReason: string; userId: string; userRole: AppRole;
};

export async function completeProcessing(input: ProcessInput) {
  authorize(input.userRole, "process:batch");
  const recon = reconcileProcessing(input.inputWeightKg, input.outputs.map(o => ({ productId: o.productId, actualKg: o.actualKg })), input.lossKg);
  if (!recon.reconciled) throw new Error(`${Math.abs(recon.differenceKg)} kg remains unaccounted`);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [batch] = await tx.select().from(deliveryBatches).where(eq(deliveryBatches.id, input.batchId)).for("update");
    if (!batch) throw new Error("Batch not found");
    assertCanConsume(Number(batch.remainingRawKg), input.inputWeightKg);
    const [session] = await tx.insert(processingSessions).values({
      batchId: batch.id, inputWeightKg: String(input.inputWeightKg),
      reconciliationDifferenceKg: String(recon.differenceKg), lossReason: input.lossReason, completedBy: input.userId,
    }).returning();
    const costKg = await tx.select({ cost: inventoryLots.unitCostKg }).from(inventoryLots)
      .where(and(eq(inventoryLots.batchId, batch.id), eq(inventoryLots.location, "RAW_COOLER"))).limit(1);
    const inputCost = Number(costKg[0]?.cost ?? 0);
    await tx.insert(processingOutputs).values(input.outputs.map(o => ({
      sessionId: session.id, productId: o.productId, expectedWeightKg: String(o.expectedKg),
      actualWeightKg: String(o.actualKg), costAllocated: String(o.actualKg * inputCost),
    })));
    await tx.update(deliveryBatches).set({
      remainingRawKg: sql`${deliveryBatches.remainingRawKg} - ${input.inputWeightKg}`,
      status: Number(batch.remainingRawKg) === input.inputWeightKg ? "PROCESSED" : "PARTIALLY_PROCESSED",
    }).where(eq(deliveryBatches.id, batch.id));
    await tx.update(inventoryLots).set({ physicalKg: sql`${inventoryLots.physicalKg} - ${input.inputWeightKg}` })
      .where(and(eq(inventoryLots.batchId, batch.id), eq(inventoryLots.location, "RAW_COOLER")));
    for (const output of input.outputs) {
      await tx.insert(inventoryLots).values({ productId: output.productId, batchId: batch.id, location: "FINISHED_COOLER", physicalKg: String(output.actualKg), reservedKg: "0", unitCostKg: String(inputCost) });
      await tx.insert(stockLedgerEntries).values({
        transactionId: `PROC-${session.id.slice(0, 8)}`, productId: output.productId, batchId: batch.id,
        quantityKg: String(output.actualKg), direction: "IN", movementType: "PROCESSING_OUTPUT",
        source: "PROCESSING", destination: "FINISHED_COOLER", reason: "Completed block-out",
        relatedEntityType: "ProcessingSession", relatedEntityId: session.id, userId: input.userId,
      });
    }
    await tx.insert(stockLedgerEntries).values({
      transactionId: `PROC-${session.id.slice(0, 8)}`, productId: batch.rawProductId, batchId: batch.id,
      quantityKg: String(input.inputWeightKg), direction: "OUT", movementType: "PROCESSING_INPUT",
      source: "RAW_COOLER", destination: "PROCESSING", reason: "Block-out input",
      relatedEntityType: "ProcessingSession", relatedEntityId: session.id, userId: input.userId,
    });
    await tx.insert(auditLogs).values({ userId: input.userId, action: "BATCH_PROCESSED", entityType: "ProcessingSession", entityId: session.id, newValues: input });
    return session;
  });
}
