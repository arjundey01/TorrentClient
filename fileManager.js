
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
const Bitfield = require('./utils').Bitfield;
const fs = require('fs');
const config = require('./config');


class FileManager{

    constructor(torrent, toDl, bfFile, bf, fileToWrite, filesToDl){
        this.torrent = torrent;
        this.toDl = toDl;
        this.bfFile = bfFile;
        this.bitfield = bf;
        this.fileToWrite = fileToWrite;
        this.filesToDl=filesToDl;
    }

    writePiece(piece,pieceData){
        if(!this.toDl.get(piece))return null;
        let file = this.fileToWrite[piece];
        let offset=0;
        for(let i=0; i<piece; i++){
            if(this.fileToWrite[piece]==this.fileToWrite[i])
                offset+=this.torrent.pieceLength;
        }
        fs.writeSync(file,pieceData,0,pieceData.length,offset);
      
    };
    
    updateBitfield(bitfield){
        fs.writeSync(this.bfFile,bitfield.buffer,0,bitfield.buffer.length,0);
    };

    parseFiles(){
        if(!this.torrent.files){
            let data=Buffer.alloc(this.torrent.size);
            fs.readSync(this.fileToWrite[0],data,0,data.length,0);
            fs.writeFileSync(config.DOWNLOADDIR + this.torrent.filename, data);
            return;
        }
        let prefSize = 0;
        let ctr=-1;
        this.torrent.files.forEach((file,ind)=>{
            if(this.filesToDl.get(ind)){
                let startPiece = Math.floor(prefSize/torrent.pieceLength);
                console.log(startPiece);
                console.log(this.fileToWrite);
                 let data = Buffer.alloc(file.size);
                console.log(startPiece + '=========================='+file.size+'---------'+this.fileToWrite[startPiece])
                let offset=0;
                for(let i=0; i<startPiece; i++){
                    if(this.fileToWrite[startPiece]==this.fileToWrite[i])
                    offset+=this.torrent.pieceLength;
                }
                offset+=prefSize%torrent.pieceLength;
                fs.readSync(this.fileToWrite[startPiece],data, 0, data.length, offset);
                //let data = fs.readFileSync(config.DOWNLOADDIR + torrent.filename + '/' + torrent.md5 + '0' +'.mtr');
                console.log('read');
                fs.writeFileSync(config.DOWNLOADDIR + torrent.filename + '/' + file.path, data);
                console.log('written');
                //ctr++;
            }
            prefSize+=file.size;
        });

        process.exit();
    };
};

var files = new Array();
var torrent;
var toDl;
var bfFile;
var bitfield;
var fileToWrite = new Object();

module.exports.init = (torrentToDl, callback)=>{
    torrent = torrentToDl;
    let bitfieldPath = config.BITFIELDDIR;

    if(torrent.files){
        bitfieldPath = bitfieldPath + torrent.filename + '/';
        if(!fs.existsSync(bitfieldPath)){
            fs.mkdirSync(bitfieldPath);
        }
    }
    
    bitfieldPath = bitfieldPath + torrent.md5 + '.bfd'

    if(fs.existsSync(bitfieldPath)){
        bitfield= Bitfield.fromBuffer(fs.readFileSync(bitfieldPath),torrent.pieceCount);
    }else{
        bitfield= new Bitfield(torrent.pieceCount);
        fs.writeFileSync(bitfieldPath,bitfield.buffer);
    }

    bfFile=openOverwrite(bitfieldPath);
    selectFiles(callback);
}

function selectFiles(callback){
    if(torrent.files){
        let mxNameLen=0;
        torrent.files.forEach((ele=>{mxNameLen=Math.max(mxNameLen,ele.path.length);}));
        mxNameLen = Math.ceil(mxNameLen/8)*8;
        torrent.files.forEach((ele,ind) => {
            let name = ele.path;
            for(var i=0;i<Math.ceil((mxNameLen-name.length)/8);i++)name+='\t';
            console.log((ind+1) + '. ' + name + '\t' + (ele.size/1048576).toFixed(2) + 'MB');
        });
        readline.question('Enter space separated indices of the files you want to download ( * for all): ',(inp)=>{
            let sel;
            if(inp=='*') sel = Array.from({length: torrent.pieceCount}, (_, i) => i + 1);
            else sel = inp.split(' ').map((ele)=>parseInt(ele));
            let prefSum = new Array();
            prefSum.push(0);
            torrent.files.forEach((ele,ind)=>{
                prefSum[ind+1]=prefSum[ind] + ele.size;
            })
            toDl= new Set();
            sel.forEach((ele)=>{
                let beg = Math.floor(prefSum[ele-1]/torrent.pieceLength);
                let end = Math.floor((prefSum[ele-1]+torrent.files[ele-1].size)/torrent.pieceLength);
                for( var i = beg; i<=end; i++)toDl.add(i+1);
            })
            let bf = Bitfield.fromArray(toDl,torrent.pieceCount);
            let filesToDl = Bitfield.fromArray(sel,torrent.files.length);
            bf.print();
            toDl=bf;
            createFiles();
            let fm = new FileManager(torrent, toDl, bfFile, bitfield, fileToWrite, filesToDl);
            callback(fm);
        });
    }else{
        toDl = new Bitfield(torrent.pieceCount);
        for(let i=0; i < toDl.length; i++)toDl.set(i);
        createFiles();
        let fm = new FileManager(torrent, toDl, bfFile, bitfield, fileToWrite, null);
        callback(fm);
    }
};

// declare an array to store the file references
//create and/or open files here and store them in the array
function createFiles(){
    let dir=config.DOWNLOADDIR;
    if(torrent.files){
        dir = dir + torrent.filename + '/'; 
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        let i=0;
        let ctr=0;
        while(i<torrent.pieceCount){
            if(!toDl.get(i)){
                i++;
                continue;
            }
            let j=i+1;
            while(j<torrent.pieceCount){
                if(!toDl.get(j))break;
                j++;
            }
            let path=dir + torrent.md5 + ctr + '.mtr';
            if(!fs.existsSync(path))
                fs.writeFileSync(path, Buffer.alloc((j-i)*torrent.pieceLength),()=>{});
            let t = openOverwrite(path);
            for(let k=i; k<j; k++){
                fileToWrite[k]=t;
            }
            ctr++;
            i=j;
        }
    }
    else{
        let path = dir + torrent.md5 + '.mtr';
        if(!fs.existsSync(path))
            fs.writeFileSync(path, Buffer.alloc(torrent.size),()=>{});
        let t=openOverwrite(path);
        for(let k=0; k<torrent.pieceCount; k++){
            fileToWrite[k]=t;
        }
    }

};



var openOverwrite=function(path){
    let oldData=fs.readFileSync(path);
    let fd=fs.openSync(path, 'w+'); 
    fs.writeSync(fd,oldData);
    return fd;
}