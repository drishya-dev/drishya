import {capturedResources} from './captured-resources.ts';
import {delimitedBlocks} from './delimited-data.ts';

/** Offers reading modes, never asserts that supplied preview text is complete evidence. */
export function capturedContent(text:string){
 if(text.length>262144||new TextEncoder().encode(text).length>262144)return {json:false,delimited:[],resources:undefined};
 return {json:/^\s*[\[{]/.test(text),delimited:delimitedBlocks(text),resources:capturedResources(text)};
}
