export type ScaleProductPayload={productId:number;plu:string;sku:string;labelName:string;department:string;unit:"kg";pricePerKg:number;barcodePrefix:string;barcodeMode:"PRICE"|"WEIGHT";labelFormat:string;tareKg:number;shelfLifeDays:number;packedOn:boolean};
export type ScaleConnection={id:number;name:string;brand:string;connectorType:string;location:string;endpoint:string;databaseTable:string};
export type ScaleSyncResult={accepted:boolean;reference:string;itemCount:number;error?:string};

export interface ScaleAdapter{
  readonly type:string;
  testConnection(connection:ScaleConnection):Promise<boolean>;
  pushProducts(connection:ScaleConnection,products:ScaleProductPayload[]):Promise<ScaleSyncResult>;
  getSyncStatus(reference:string):Promise<"PENDING"|"COMPLETED"|"FAILED"|"OFFLINE">;
}

abstract class BridgeAdapter implements ScaleAdapter{
  abstract readonly type:string;
  async testConnection(connection:ScaleConnection){return Boolean(connection.id&&connection.name);}
  async pushProducts(_connection:ScaleConnection,products:ScaleProductPayload[]){return{accepted:true,reference:`BRIDGE-${Date.now()}`,itemCount:products.length};}
  async getSyncStatus(_reference:string){return"PENDING" as const;}
}
export class TeraokaMySqlAdapter extends BridgeAdapter{readonly type="TERAOKA_MYSQL";}
export class GenericSqlAdapter extends BridgeAdapter{readonly type="GENERIC_SQL";}
export class GenericApiAdapter extends BridgeAdapter{readonly type="REST_JSON";}
export class CsvScaleAdapter extends BridgeAdapter{readonly type="CSV";}

export function adapterFor(connectorType:string):ScaleAdapter{
  if(connectorType==="MYSQL_BRIDGE")return new TeraokaMySqlAdapter();
  if(connectorType==="GENERIC_SQL")return new GenericSqlAdapter();
  if(connectorType==="REST_JSON")return new GenericApiAdapter();
  return new CsvScaleAdapter();
}

export function decodeWeightedBarcode(barcode:string,mapping:{barcodePrefix:string;plu:string;barcodeMode:string;sellingPrice:number}){
  const digits=barcode.replace(/\D/g,"");if(digits.length!==13||!digits.startsWith(mapping.barcodePrefix))return null;
  const plu=digits.slice(2,7).replace(/^0+/,"")||"0";if(plu!==(mapping.plu.replace(/^0+/,"")||"0"))return null;
  const encoded=Number(digits.slice(7,12));if(!Number.isFinite(encoded))return null;
  const value=mapping.barcodeMode==="WEIGHT"?encoded/1000:encoded/100;
  const quantity=mapping.barcodeMode==="WEIGHT"?value:(mapping.sellingPrice>0?value/mapping.sellingPrice:0);
  const total=mapping.barcodeMode==="WEIGHT"?quantity*mapping.sellingPrice:value;
  return{quantity:Number(quantity.toFixed(6)),total:Number(total.toFixed(2)),encodedAs:mapping.barcodeMode};
}
