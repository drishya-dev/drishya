/** Let the stem yield reading space while retaining the literal extension. */
export function FileRowName({name,folder=false}:{name:string;folder?:boolean}) {
 const dot=folder?-1:name.lastIndexOf('.');
 return <span className="file-row-name">{dot>0?<><span className="file-row-stem">{name.slice(0,dot)}</span><span className="file-row-extension">{name.slice(dot)}</span></>:name}</span>;
}
