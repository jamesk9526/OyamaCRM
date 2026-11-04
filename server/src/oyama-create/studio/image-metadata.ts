import { CreateError } from "../domain.js";
export function studioImageSize(bytes:Buffer,mime:string):{width:number;height:number} {
  let width=0,height=0;
  if(mime==="image/png"&&bytes.length>=33&&bytes.subarray(12,16).toString()==="IHDR"){width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);}
  if(mime==="image/jpeg"){
    let offset=2;
    while(offset+4<bytes.length){if(bytes[offset]!==255)break;while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;if(offset+2>bytes.length)break;const size=bytes.readUInt16BE(offset);if(size<2||offset+size>bytes.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=7){height=bytes.readUInt16BE(offset+3);width=bytes.readUInt16BE(offset+5);break;}offset+=size;
    }
  }
  if(mime==="image/webp"&&bytes.length>=30){const format=bytes.subarray(12,16).toString();if(format==="VP8X"){width=bytes.readUIntLE(24,3)+1;height=bytes.readUIntLE(27,3)+1;}else if(format==="VP8L"&&bytes[20]===47){const packed=bytes.readUInt32LE(21);width=(packed&16383)+1;height=((packed>>>14)&16383)+1;}else if(format==="VP8 "&&bytes.subarray(23,26).equals(Buffer.from([157,1,42]))){width=bytes.readUInt16LE(26)&16383;height=bytes.readUInt16LE(28)&16383;}}
  if(!width||!height||width>16000||height>16000||width*height>40_000_000)throw new CreateError(400,"Choose a valid image up to 40 megapixels and 16,000 pixels per side.");
  return {width,height};
}
