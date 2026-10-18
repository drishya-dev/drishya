export interface NativeQuestion {
  id:string; header:string; question:string; multiple:boolean; allowText:boolean;
  options:{id:string;label:string;description:string}[];
}
export interface NativeInputRequest {id:string;questions:NativeQuestion[]}
