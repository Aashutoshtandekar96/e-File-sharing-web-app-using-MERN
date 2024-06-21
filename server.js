// using express JS
var express = require("express");
var app = express();

// express formidable is used to parse the form data values
var formidable = require("express-formidable");
app.use(formidable());

// use mongo DB as database
var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;

// the unique ID for each mongo DB document
var ObjectId = mongodb.ObjectId;

// receiving http requests
var httpObj = require("http");
var http = httpObj.createServer(app);

// to encrypt/decrypt passwords
var bcrypt = require("bcrypt");
var nodemailer=require("nodemailer");
var nodemailerFrom="";
var nodemailerObject={
    service:"gmail",
    host:"smtp.gmail.com",
    port:465,
    secure:true,
    auth:{
        user:"",
        pass:""
    }
};



// to store files
var fileSystem = require("fs");

// to start the session
var session = require("express-session");
app.use(session({
    secret: 'secret key',
    resave: false,
    saveUninitialized: false
}));

// define the publically accessible folders
app.use("/public/css", express.static(__dirname + "/public/css"));
app.use("/public/js", express.static(__dirname + "/public/js"));
app.use("/public/font-awesome-4.7.0", express.static(__dirname + "/public/font-awesome-4.7.0"));
app.use("/public/fonts", express.static(__dirname + "/public/fonts"));


// using EJS as templating engine
app.set('view engine', 'ejs');

var rimraf = require("rimraf");


var mainURL = "http://localhost:3000";

// global database object
var database = null;

app.use(function (request, result, next) {
    request.mainURL = mainURL;
    request.isLogin = (typeof request.session.user !== "undefined");
    request.user = request.session.user;

    // continue the request
    next();
});




//recursice function to get the folder from uploaded
function recursiveGetFolder (files, _id){
  var singleFile = null;

  for( var a=0;a<files.length;a++){
    const file = files[a];

    //return if file type is folder and ID is found
    if(file.type == "folder"){
      if(file._id == _id) {
        return file;
      }

      //if it has files, then do the recursion
      if(file.files.length >0) {
        singleFile = recursiveGetFolder(file.files, _id);
        // return the file if found in sub-folders
        if(singleFile != null){
          return singleFile;
        }
      }
    }
  }
}

// function to add new uploaded object and return the updated array
function getUpdatedarray(arr, _id, uploadedObj) {
  for (var a=0;a<arr.length;a++) {
      if(arr[a].type == "folder") {
         if(arr[a]._id == _id) {
            arr[a].files.push(uploadedObj);
            arr[a]._id = ObjectId(arr[a]._id); 
         }

         // if it has files, then do the recursion
         if(arr[a].files.length > 0) {
            arr[a]._id = ObjectId(arr[a]._id);
            getUpdatedarray(arr[a].files, _id, uploadedObj);
         }
      }
   }
 return arr;
}


// recursive function to remove the file and return the updated array
function removeFileReturnUpdated(arr, _id) {
  for (var a = 0; a < arr.length; a++) {
    if (arr[a].type != "folder" && arr[a]._id == _id) {
      // remove the file from uploads folder
      try {
        fileSystem.unlinkSync(arr[a].filePath);
      } catch (exp) {
        //
      }
      // remove the file from array
      arr.splice(a, 1);
      break;
    }

    // do the recursion if it has sub-folders
    if (arr[a].type == "folder" && arr[a].files.length > 0) {
      arr[a]._id = ObjectId(arr[a]._id);
      removeFileReturnUpdated(arr[a].files, _id);
    }
  }

  return arr;
}



//recursive function to remove the folder and return the updated array

function removeFolderReturnUpdated(arr, _id) {
  for (var a = 0; a < arr.length; a++) {
    if (arr[a].type == "folder") {
      if (arr[a]._id == _id) {
        //remove the folder with all sub-directories in it

        rimraf(arr[a].folderPath, function () {
          console.log("done");
        });
        arr.splice(a, 1);
        break;
      }

      if (arr[a].files.length > 0) {
        arr[a]._id = ObjectId(arr[a]._id);
        removeFolderReturnUpdated(arr[a].files, _id);
      }
    }
  }
  return arr;
}



// recursive function to get the file from uploaded
function recursiveGetFile (files, _id) {
  var singleFile = null;

  for (var a = 0; a < files.length; a++) {
      const file = files[a];

      // return if file type is not folder and ID is found
      if (file.type != "folder") {
          if (file._id == _id) {
              return file;
          }
      }

      // if it is a folder and have files, then do the recursion
      if (file.type == "folder" && file.files.length > 0) {
          singleFile = recursiveGetFile(file.files, _id);
          // return the file if found in sub-folders
          if (singleFile != null) {
              return singleFile;
          }
      }
  }
}



//recursive function to get the shared folder
function recursiveGetSharedFolder(files, _id) {
  var singleFile = null;

  for (var a = 0; a < files.length; a++) {
    var file = (typeof files[a].file === "undefined") ? files[a] : files[a].file;

    // Return if file type is folder and Id is found
    if ( file.type == "folder") {
      if (file._id == _id) {
        return file;
      }

      // If it has files, then do the recursion
      if ( file.files.length > 0) {
        singleFile = recursiveGetSharedFolder(file.files, _id);

        // Return the file if found in sub-folders
        if (singleFile !== null) {
          return singleFile;
        }
      }
    }
  }

  return null; // Return null if no matching file is found
}


// recursive function to remove the shared folder and return the updated array

function removeSharedFolderReturnUpdated(arr, _id){
  for (var a=0; a<arr.length; a++){
      var file = (typeof arr[a].file === "underfined") ? arr[a] : arr[a].file;
      if (file.type == "folder"){
          if (file._id == _id){
              arr.splice(a ,1);
              break;
          }

          //do the recursion if it has sub-folders
          if (file.files.length>0){
              file._id = ObjectId(file._id);
              removeSharedFolderReturnUpdated(file.files, _id);
          }
      }
  }
  return arr;
}


//recursive function to remove the shared file and return the updated array

//recursive function to remove the shared file and return the updated array
function removeSharedFileReturnUpdated(arr, _id){
  for (var a = 0; a <arr.length; a++){
      var file = (typeof arr[a].file === "underfined") ? arr[a] : arr[a].file;

//remove the file if found
  if (file.type != "folder" && file._id == _id){
      arr.splice(a, 1);
      break;
    
  } 
  
  
  //do the recursion if it has sub-folders
  if (file.type == "folder"&& file.files.length > 0) {
    arr[a]._id = ObjectId(arr[a]._id);
    removeSharedFileReturnUpdated(file.files, _id);
  }
  }
  return arr;
}


//recursive function to get the shared file
function recursiveGetSharedFile(files, _id){
  var singleFile = null;

  for(var a = 0; a < files.length; a++){
    var file = (typeof files[a].file === "undefined") ? files[a] : files[a].file;

    //return if the type is not folder and IS is found
    if (file.type != "folder") {
      if(file._id == _id) {
        return file;
      }
    }

    // if is is a folder and have files, then do the recursion
    if(file.type == "folder" && file.files.length > 0) {
      singleFile = recursiveGetSharedFile(file.files, _id);

      //return the file if found in sub-folders
      if(singleFile != null) {
        return singleFile;
      }
    }
  }
}



//recursive function to rename sub-folders
function renameSubFolders(arr, oldName, newName) {
  for (var a = 0; a < arr.length; a++) {
    // Set new folder path by splitting it into parts by "/"
    var pathParts = (arr[a].type == "folder") ? arr[a].folderPath.split("/") : arr[a].filePath.split("/");

    var newPath = "";
    for (var b = 0; b < pathParts.length; b++) {
      // Replace the old name with the new name
      if (pathParts[b] == oldName) {
        pathParts[b] = newName;
      }

      newPath += pathParts[b];
      // Append "/" at the end, except the last index
      if (b < pathParts.length - 1) {
        newPath += "/";
      }
    }

    if (arr[a].type == "folder") {
      arr[a].folderPath = newPath;

      if (arr[a].files.length > 0) {
        renameSubFolders(arr[a].files, _id, newName);
      }
    } else {
      arr[a].filePath = newPath;
    }
  }
}

//recursive function to rename folder and return updated array

function renameFolderReturnUpdated(arr, _id, newName) {
  //loop through all files
  for (var a = 0; a<arr.length; a++){
    if ( arr[a].type == "folder") {
      if (arr[a]._id == _id) {

        const oldFolderName = arr[a].folderName;
        var folderPathParts = arr[a].folderPath.split("/");

        var newFolderPath = "";
        for (var b = 0; b<folderPathParts.length; b++) {
          //replace the old path with new 
          if (folderPathParts[b] == oldFolderName) {
            folderPathParts[b] = newName;
          }
          newFolderPath += folderPathParts[b];
          //append "/"  at the end, except for last index
          if(b <folderPathParts.length -1) {
            newFolderPath += "/";
          }
        }
        //rename the folder
        fileSystem.rename(arr[a].folderPath, newFolderPath, function (error) {
          //
        });

        //update the arra values
        arr[a].folderName = newName;
        arr[a].folderPath = newFolderPath;


        renameSubFolders(arr[a].files, oldFolderName, newName);
        break;
      }

      if(arr[a].files.length >0){

        //update the sub folders path
        renameFolderReturnUpdated(arr[a].files, _id, newName);
      }
    }
  }
  return arr;
}






function renameFileReturnUpdated(arr, _id, newName) {
  for (var a = 0; a < arr.length; a++) {
    if (arr[a].type != "folder") {
      if (arr[a]._id == _id) {
        const oldFileName = arr[a].name;
        var filePathParts = arr[a].filePath.split("/");
        var newFilePath = "";

        for (var b = 0; b < filePathParts.length; b++) {
          if (filePathParts[b] == oldFileName) {
            filePathParts[b] = newName;
          }
          newFilePath += filePathParts[b];
          if (b < filePathParts.length - 1) {
            newFilePath += "/";
          }
        }

        fileSystem.rename(arr[a].filePath, newFilePath, function (error) {
          
        });

        arr[a].name = newName;
        arr[a].filePath = newFilePath;
        break;
      }
    }

    if (arr[a].type == "folder" && arr[a].files.length > 0) {
      renameFileReturnUpdated(arr[a].files, _id, newName);
    }
  }
  return arr;
}



// recursive Tunction to push in movea Tolder Tites array 
function updateMovedToFolderParent_ReturnUpdated (arr, _id, moveFolder) {

for (var a = 0; a <arr.length; a++) { 
  if (arr[a].type =="folder") {

  if (arr[a]._id == _id) {
  
  moveFolder.folderPath = arr[a].folderPath + "/" + moveFolder.folderName; 
  arr[a].files.push(moveFolder);
  
  break;
  
  }
  
  // if it has further files, do the recursion
  
  if (arr[a].files.length > 0) {
  
  arr[a]._id = ObjectId(arr[a]._id); 
  updateMovedToFolderParent_ReturnUpdated(arr[a].files, _id, moveFolder);
  
  }
  
  }
  
  }
  
  return arr;
  
  }


  // recursive function to move the folder and return updated array

function moveFolderReturnUpdated(arr, _id, moveFolder, moveToFolder) {
  for (var a = 0; a < arr.length; a++) {
    if (arr[a].type == "folder") {
      if (arr[a]._id == _id) {
        // rename() will move the file
        const newPath = moveToFolder.folderPath + "/" + arr[a].folderName;

        fileSystem.rename(arr[a].folderPath, newPath, function () {
          //console.log("Folder has been moved.");
        });

        arr.splice(a, 1);

        break;
      }
      if (arr[a].files.length > 0) {
        arr[a]._id = ObjectId(arr[a]._id);
        moveFolderReturnUpdated(arr[a].files, _id, moveFolder, moveToFolder);
      }
    }
  }

  return arr;
}


function recursiveGetAllFolders(files, _id){
  var folders =[];
  for(var a=0; a<files.length; a++){
    const file= files[a];
    if(file.type =="folder"){
      if(file._id != _id){
        folders.push(file);
        if(file.files.length >0){
          var tempFolders = recursiveGetAllFolders(file.files, _id);

          for(var b=0; b< tempFolders.length; b++){
            folders.push(tempFolders[b]);
          }
        }
      }
    }
  }
  return folders; 
}



 // recursive function to search uploaded files
 function recursiveSearch(files, query) {
  for (var a = 0; a < files.length; a++) {
    const file = files[a];

    if (file.type === "folder") {
      // search folder case-insensitive
      if (file.folderName.toLowerCase().includes(query.toLowerCase())) {
        return file;
      }

      if (file.files.length > 0) {
        var singleFile = recursiveSearch(file.files, query);
        if (singleFile !== null) {
          // need parent folder in case of files
          if (singleFile.type !== "folder") {
            singleFile.parent = file;
          }
          return singleFile;
        }
      }
    } else {
      if (file.name.toLowerCase().includes(query.toLowerCase())) {
        return file;
      }
    }
  }

  return null; // No file or folder found
}

// recursive function to search shared files
function recursiveSearchShared(files, query) {
  for (var a = 0; a < files.length; a++) {
    var file = (typeof files[a].file === "undefined" || files[a].file === null) ? files[a] : files[a].file;

    if (file.type === "folder") {
      if (file.folderName.toLowerCase().includes(query.toLowerCase())) {
        return file;
      }

      if (file.files.length > 0) {
        var singleFile = recursiveSearchShared(file.files, query);
        if (singleFile !== null) {
          if (singleFile.type !== "folder") {
            singleFile.parent = file;
          }
          return singleFile;
        }
      }
    } else {
      if (file.name.toLowerCase().includes(query.toLowerCase())) {
        return file;
      }
    }
  }

  return null; // No file or folder found
}














// start the http server
http.listen(3000, function () {
    console.log("Server started at " + mainURL);

    // connect with mongo DB server
    mongoClient.connect("mongodb://127.0.0.1:27017", {
        useUnifiedTopology: true
           }, function (error, client) {
             // connect database (it will automatically create the database if not exists)
             database = client.db("file_transfer");
             console.log("Database connected.");


             app.get("/Search", async function(request, result) {
              const search = request.query.search;
            
              if (request.session.user) {
                var user = await database.collection("users").findOne({
                  "_id": ObjectId(request.session.user._id)
                });
                var fileUploaded = await recursiveSearch(user.uploaded, search);
                var fileShared = await recursiveSearchShared(user.sharedWithMe, search);
            
                // check if file is uploaded or shared with user
                if (fileUploaded === null && fileShared === null) {
                  request.status = "error";
                  request.message = "File/folder '" + search + "' is neither uploaded nor shared with you.";
            
                  result.render("Search", {
                    "request": request
                  });
                  return false;
                }
            
                var file = (fileUploaded === null) ? fileShared : fileUploaded;
            
                file.isShared = (fileUploaded === null);
                result.render("Search", {
                  "request": request,
                  "file": file
                });
            
                return false;
              }
            
              result.redirect("/Login");
            });
            
           
            


            
             app.post("/DeleteLink", async function(request , result){
              const _id = request.fields._id;

              if(request.session.user){
                 var link = await database.collection("public_links").
                     findOne({
                     $and: [{
                         "uploadedBy._id":ObjectId(request.session.user
                           ._id)

                 },{
                   "_id": ObjectId(_id)
                 }]  


             });
             if(link == null){
               request.session.status = "error";
               request.session.message ="Link does not exits.";

               const backURL = request.header("Referer") || "/";
               result.redirect(backURL);
               return false;
             }
             await database.collection("public_links").deleteOne({
               $and: [{
                 "uploadedBy._id":ObjectId(request.session.user._id)
               },{
                 "_id": ObjectId(_id)
               }]
             });

             request.session.status = "success";
             request.session.message = "Link has been deleted.";

             const backURL = request.header("Referer") || "/";
             result.redirect(backURL);
             return false;
           }

           result.redirect("/Login");
         });


             app.get("/MySharedLinks", async function(request , result){
              if(request.session.user){
                var links = await database.collection("public_links").
                find({
                  "uploadedBy._id": ObjectId(request.session.user._id
                    )
                }).toArray();

                result.render("MySharedLinks",{
                  "request":request,
                  "links": links
                });
                return false;
              }

              result.redirect("/Login");
             });


             app.get("/SharedViaLink/:hash", async function(request,result){
              const hash = request.params.hash;

              var link = await database.collection("public_links").findOne
              ({
                "hash":hash

              });
              if(link == null){
                request.session.status = "error";
                request.session.message = "Link expired.";

                result.render("SharedViaLink",{
                  "request": request
                });
                return false;
              }

              result.render("SharedViaLink",{
                "request": request,
                "link": link
              });
             });


             app.post("/ShareViaLink", async function (request, result) {
              const _id = request.fields._id;
            
              if (request.session.user) {
                const user = await database.collection("users").findOne({
                  "_id": ObjectId(request.session.user._id)
                });
                const file = await recursiveGetFile(user.uploaded, _id);
                const folder = await recursiveGetFolder(user.uploaded, _id);
            
                if (!file && !folder) {
                  request.session.status = "error";
                  request.session.message = "File does not exist";
            
                  const backURL = request.header("Referer") || "/";
                  result.redirect(backURL);
                  return;
                }
            
                if (folder !=null) {
                  folder.name = folder.folderName;
                  folder.filePath = folder.folderPath;
                  delete folder.files;
                  file = folder;
                }
            
                bcrypt.hash(file.name, 10, async function (error, hash) {
                  if (error) {
                    console.log(error);
                    return;
                  }
            
                  hash = hash.substring(10, 20);
                  const link = mainURL + "/SharedViaLink/" + hash;
                  await database.collection("public_links").insertOne({
                    "hash": hash,
                    "file": file,
                    "uploadedBy": {
                      "_id": user._id,
                      "name": user.name,
                      "email": user.email
                    },
                    "createdAt": new Date().getTime()
                  });
            
                  request.session.status = "success";
                  request.session.message = "Share link: " + link;
            
                  const backURL = request.header("Referer") || "/";
                  result.redirect(backURL);
                });
              } else {
                result.redirect("/Login");
              }
            });
            

             // get all folders
             app.post("/GetAllFolders", async function (request, result) {
               const _id = request.fields._id;
               const type = request.fields.type;

               if (request.session.user) {
                 var user = await database
                   .collection("users")
                   .findOne({ "_id": ObjectId(request.session.user._id) });

                 var tempAllFolders = recursiveGetAllFolders(user.uploaded, _id);

                 var folders = [];

                 for (var a = 0; a < tempAllFolders.length; a++) {
                   folders.push({
                     "_id": tempAllFolders[a]._id,
                     "folderName": tempAllFolders[a].folderName,
                   });
                 }

                 result.json({
                   "status": "success",

                   "message": "Record has been fetched.",

                   "folders": folders,
                 });
                 return false;
               }
               result.json({
                 "status": "error",
                 "message": "Please login to perform this action.",
               });
             });

             // move file from one folder to another

             app.post("/MoveFile", async function (request, result) {
               const _id = request.fields._id;
               const type = request.fields.type;
               const folder = request.fields.folder;

               if (request.session.user) {
                 const user = await database
                   .collection("users")
                   .findOne({ _id: ObjectId(request.session.user._id) });

                 var updatedArray = user.uploaded;

                 if (type == "folder") {
                   // Get both folders
                   const moveFolder = await recursiveGetFolder(
                     user.uploaded,
                     _id
                   );
                   const moveToFolder = await recursiveGetFolder(
                     user.uploaded,
                     folder
                   );

                   // Move folder in uploads folder
                   updatedArray = await moveFolderReturnUpdated(
                     user.uploaded,
                     _id,
                     moveFolder,
                     moveToFolder
                   );

                   // Update folder array where the file is moved
                   updatedArray = await updateMovedToFolderParent_ReturnUpdated(
                     updatedArray,
                     folder,
                     moveFolder
                   );
                 }

                 await database.collection("users").updateOne(
                   {
                     "_id": ObjectId(request.session.user._id),
                   },
                   {
                     $set: {
                       "uploaded": updatedArray,
                     }
                   }
                 );

                 const backURL = request.header("Referer") || "/";
                 result.redirect(backURL);
                 return false;
               }

               result.redirect("/Login");
             });

             app.post("/RenameFile", async function (request, result) {
               const _id = request.fields._id;
               const name = request.fields.name;
               console.log(_id);
               console.log(name);

               if (request.session.user) {
                 var user = await database.collection("users").findOne({
                   _id: ObjectId(request.session.user._id),
                 });

                 var updatedArray = await renameFileReturnUpdated(
                   user.uploaded,
                   _id,
                   name
                 );
                 for (var a = 0; a < updatedArray.length; a++) {
                   updatedArray[a]._id = ObjectId(updatedArray[a]._id);
                 }

                 await database.collection("users").updateOne(
                   {
                     _id: ObjectId(request.session.user._id),
                   },
                   {
                     $set: {
                       uploaded: updatedArray,
                     },
                   }
                 );

                 const backURL = request.header("Referer") || "/";
                 result.redirect(backURL);
                 return false;
               }

               result.redirect("/Login");
             });

             //rename folder
             app.post("/RenameFolder", async function (request, result) {
               const _id = request.fields._id;
               const name = request.fields.name;

               console.log(_id);
               console.log(name);

               if (request.session.user) {
                 var user = await database.collection("users").findOne({
                   _id: ObjectId(request.session.user._id),
                 });

                 var updatedArray = await renameFolderReturnUpdated(
                   user.uploaded,
                   _id,
                   name
                 );
                 for (var a = 0; a < updatedArray.length; a++) {
                   updatedArray[a]._id = ObjectId(updatedArray[a]._id);
                 }

                 await database.collection("users").updateOne(
                   {
                     _id: ObjectId(request.session.user._id),
                   },
                   {
                     $set: {
                       uploaded: updatedArray,
                     },
                   }
                 );

                 const backURL = request.header("Referer") || "/";
                 result.redirect(backURL);
                 return false;
               }

               result.redirect("/Login");
             });

             app.post("/DownloadFile", async function (request, result) {
               const _id = request.fields._id;

               // Check if the user is logged in
               if (request.session.user) {
                 var user = await database.collection("users").findOne({
                   _id: ObjectId(request.session.user._id),
                 });

                 // Search for the file in user's uploaded and shared files
                 var fileUploaded = await recursiveGetFile(user.uploaded, _id);
                 var fileShared = await recursiveGetSharedFile(
                   user.sharedWithMe,
                   _id
                 );

                 // If the file is not found in either uploaded or shared files
                 if (fileUploaded == null && fileShared == null) {
                   result.json({
                     status: "error",
                     message: "File is neither uploaded nor shared with you.",
                   });
                   return false;
                 }

                 // Determine the file to be downloaded
                 var file = fileUploaded == null ? fileShared : fileUploaded;

                 // Read the file content and send it in the response
                 fileSystem.readFile(file.filePath, function (error, data) {
                   result.json({
                     status: "success",
                     message: "Data has been fetched.",
                     arrayBuffer: data,
                     fileType: file.type,
                     fileName: file.name,
                   });
                 });
                 return false;
               }

               // If the user is not logged in, send an error response
               result.json({
                 status: "error",
                 message: "Please login to perform this action.",
               });
               return false;
             });

             // delete shared file
             app.post("/DeleteSharedFile", async function (request, result) {
               const _id = request.fields._id;
               console.log(_id);

               if (request.session.user) {
                 var user = await database.collection("users").findOne({
                   _id: ObjectId(request.session.user._id),
                 });
                 console.log(user);

                 var updatedArray = await removeSharedFileReturnUpdated(
                   user.sharedWithMe,
                   _id
                 );
                 for (var a = 0; a < updatedArray.length; a++) {
                   updatedArray[a]._id = ObjectId(updatedArray[a]._id);
                 }

                 console.log(updatedArray);

                 await database.collection("users").updateOne(
                   {
                     _id: ObjectId(request.session.user._id),
                   },
                   {
                     $set: {
                       sharedWithMe: updatedArray,
                     },
                   }
                 );

                 const backURL = request.header("Referer") || "/";
                 result.redirect(backURL);
                 return false;
               }

               result.redirect("/Login");
             });

             //delete shared folder
             app.post(
               "/DeleteSharedDirectory",
               async function (request, result) {
                 const _id = request.fields._id;

                 if (request.session.user) {
                   var user = await database.collection("users").findOne({
                     _id: ObjectId(request.session.user._id),
                   });

                   var updatedArray = await removeSharedFolderReturnUpdated(
                     user.sharedWithMe,
                     _id
                   );
                   for (var a = 0; a < updatedArray.length; a++) {
                     updatedArray[a]._id = ObjectId(updatedArray[a]._id);
                   }

                   await database.collection("users").updateOne(
                     {
                       _id: ObjectId(request.session.user._id),
                     },
                     {
                       $set: {
                         sharedWithMe: updatedArray,
                       },
                     }
                   );

                   const backURL = request.header("Referer") || "/";
                   result.redirect(backURL);
                   return false;
                 }
                 result.redirect("/Login");
               }
             );

             app.get("/SharedWithMe/:_id?", async function (request, result) {
               const _id = request.params._id;
               console.log(_id);
               if (request.session.user) {
                 var user = await database.collection("users").findOne({
                   _id: ObjectId(request.session.user._id),
                 });

                 var files = null;
                 var folderName = "";
                 if (typeof _id == "undefined") {
                   files = user.sharedWithMe;
                 } else {
                   var folderObj = await recursiveGetSharedFolder(
                     user.sharedWithMe,
                     _id
                   );

                   if (folderObj == null) {
                     request.status = "error";
                     request.message = "Folder not found.";
                     result.render("Error", {
                       request: request,
                     });
                     return false;
                   }
                   files = folderObj.files;
                   folderName = folderObj.folderName;
                 }
                 if (files == null) {
                   request.status = "error";
                   request.message = "Directory not found.";
                   result.render("Error", {
                     request: request,
                   });
                   return false;
                 }

                 result.render("SharedWithMe", {
                   request: request,
                   files: files,
                   _id: _id,
                   folderName: folderName,
                 });
                 return false;
               }
               result.redirect("/Login");
             });

             app.post("/RemoveSharedAccess", async function (request, result) {
               const _id = request.fields._id;
               if (request.session.user) {
                 const user = await database.collection("users").findOne({
                   $and: [
                     { "sharedWithMe._id": ObjectId(_id) },
                     {
                       "sharedWithMe.sharedBy._id": ObjectId(
                         request.session.user._id
                       ),
                     },
                   ],
                 });

                 // remove from array
                 for (var a = 0; a < user.sharedWithMe.length; a++) {
                   if (user.sharedWithMe[a]._id == _id) {
                     user.sharedWithMe.splice(a, 1);
                   }
                 }

                 await database.collection("users").findOneAndUpdate(
                   {
                     $and: [
                       { "sharedWithMe._id": ObjectId(_id) },
                       {
                         "sharedWithMe.sharedBy._id": ObjectId(
                           request.session.user._id
                         ),
                       },
                     ],
                   },
                   {
                     $set: {
                       sharedWithMe: user.sharedWithMe,
                     },
                   }
                 );

                 request.session.status = "success";
                 request.session.message = "Shared access has been removed.";

                 const backURL = request.header("Referer") || "/";
                 result.redirect(backURL);
                 return false;
               }

               result.redirect("/Login");
             });

             app.post("/GetFileSharedwith", async function (request, result) {
               const _id = request.fields._id;
               console.log("me server ke get file me huu");
               console.log(_id);

               if (request.session.user) {
                 const tempUsers = await database
                   .collection("users")
                   .find({
                     $and: [
                       { "sharedWithMe.file._id": ObjectId(_id) },
                       {
                         "sharedWithMe.sharedBy._id": ObjectId(
                           request.session.user._id
                         ),
                       },
                     ],
                   })
                   .toArray();

                 var users = [];
                 for (var a = 0; a < tempUsers.length; a++) {
                   var sharedObj = null;
                   for (var b = 0; b < tempUsers[a].sharedWithMe.length; b++) {
                     if (tempUsers[a].sharedWithMe[b].file._id == _id) {
                       sharedObj = {
                         _id: tempUsers[a].sharedWithMe[b]._id,
                         sharedAt: tempUsers[a].sharedWithMe[b].createdAt,
                       };
                     }
                   }
                   users.push({
                     _id: tempUsers[a]._id,
                     name: tempUsers[a].name,
                     email: tempUsers[a].email,
                     sharedObj: sharedObj,
                   });
                 }

                 console.log(users);
                 result.json({
                   status: "success",
                   message: "Record has been fetched.",
                   users: users,
                 });
                 return false;
               }

               result.json({
                 status: "error",
                 message: "Please login to perform this action.",
               });
             });

             // share the file with the user
             app.post("/Share", async function (request, result) {
               const _id = request.fields._id;
               const type = request.fields.type;
               const email = request.fields.email;
               console.log(email);
               console.log(type);
               console.log("1");

               if (request.session.user) {
                 var user = await database.collection("users").findOne({
                   email: email,
                 });

                 console.log(user);

                 if (user == null) {
                   request.session.status = "error";
                   request.session.message =
                     "User" + email + "does not exists.";
                   result.redirect("/MyUploads");

                   return false;
                 }

                 if (!user.isVerified) {
                   request.session.status = "error";
                   request.session.message =
                     "User " + user.name + " account is not verified";
                   result.redirect("/MyUploads");
                   return false;
                 }

                 var me = await database.collection("users").findOne({
                   _id: ObjectId(request.session.user._id),
                 });

                 var file = null;
                 if (type == "folder") {
                   file = await recursiveGetFolder(me.uploaded, _id);
                 } else {
                   file = await recursiveGetFile(me.uploaded, _id);
                 }

                 if (file == null) {
                   request.session.status = "error";
                   request.session.message = "File does not exists.";
                   result.redirect("/MyUploads");

                   return false;
                 }

                 console.log(file);

                 file._id = ObjectId(file._id);

                 const sharedBy = me;

                 await database.collection("users").findOneAndUpdate(
                   {
                     _id: user._id,
                   },
                   {
                     $push: {
                       sharedWithMe: {
                         _id: ObjectId(),
                         file: file,
                         sharedBy: {
                           _id: ObjectId(sharedBy._id),
                           name: sharedBy.name,
                           email: sharedBy.email,
                         },
                         createdAt: new Date().getTime(),
                       },
                     },
                   }
                 );

                 request.session.status = "success";
                 request.session.message =
                   "File has been shared with " + user.name + ".";

                 const backURL = request.header("Referer") || "/";
                 result.redirect(backURL);
                 return false;
               }
               result.redirect("/Login");
             });

             //get user for confirmation

             app.post("/GetUser", async function (request, result) {
               const email = request.fields.email;

               if (request.session.user) {
                 var user = await database.collection("users").findOne({
                   email: email,
                 });

                 if (user == null) {
                   result.json({
                     status: "error",
                     message: "User" + email + "does not exists.",
                   });
                   return false;
                 }

                 if (!user.isVerified) {
                   result.json({
                     status: "error",
                     message: "User" + user.name + "account is not verified.",
                   });
                   return false;
                 }
                 result.json({
                   status: "success",
                   message: "Data has been fetched.",
                   user: {
                     _id: user._id,
                     name: user.name,
                     email: user.email,
                   },
                 });
                 return false;
               }
               result.json({
                 status: "error",
                 message: "Please login to perform this action.",
               });
               return false;
             });

             app.post("/DeleteDirectory", async function (request, result) {
               const _id = request.fields._id;
               if (request.session.user) {
                 var user = await database.collection("users").findOne({
                   _id: ObjectId(request.session.user._id),
                 });

                 var updatedArray = await removeFolderReturnUpdated(
                   user.uploaded,
                   _id
                 );
                 for (var a = 0; a < updatedArray.length; a++) {
                   updatedArray[a]._id = ObjectId(updatedArray[a]._id);
                 }

                 await database.collection("users").updateOne(
                   {
                     _id: ObjectId(request.session.user._id),
                   },
                   {
                     $set: {
                       uploaded: updatedArray,
                     },
                   }
                 );

                 const backURL = request.header("Referer") || "/";
                 result.redirect(backURL);
                 return false;
               }
               result.redirect("/Login");
             });

             // delete uploaded file
             app.post("/DeleteFile", async function (request, result) {
               const _id = request.fields._id;

               if (request.session.user) {
                 var user = await database.collection("users").findOne({
                   _id: ObjectId(request.session.user._id),
                 });

                 var updatedArray = await removeFileReturnUpdated(
                   user.uploaded,
                   _id
                 );
                 for (var a = 0; a < updatedArray.length; a++) {
                   updatedArray[a]._id = ObjectId(updatedArray[a]._id);
                 }

                 await database.collection("users").updateOne(
                   {
                     _id: ObjectId(request.session.user._id),
                   },
                   {
                     $set: {
                       uploaded: updatedArray,
                     },
                   }
                 );

                 const backURL = request.header("Referer") || "/";
                 result.redirect(backURL);
                 return false;
               }

               result.redirect("/Login");
             });

             app.post("/UploadFile", async function (request, result) {
               if (request.session.user) {
                 var user = await database.collection("users").findOne({
                   _id: ObjectId(request.session.user._id),
                 });

                 if (request.files.file.size > 0) {
                   const _id = request.fields._id;

                   var uploadedObj = {
                     _id: ObjectId(),
                     size: request.files.file.size,
                     name: request.files.file.name,
                     type: request.files.file.type,
                     filePath: "",
                     createdAt: new Date().getTime(),
                   };

                   var filePath = "";

                   //if it is the root path
                   if (_id == "") {
                     filePath =
                       "public/uploads/" +
                       user.email +
                       "/" +
                       new Date().getTime() +
                       "-" +
                       request.files.file.name;
                     uploadedObj.filePath = filePath;

                     if (
                       !fileSystem.existsSync("public/uploads/" + user.email)
                     ) {
                       fileSystem.mkdirSync("public/uploads/" + user.email);
                     }

                     console.log(request.files);

                     //Read the file
                     fileSystem.readFile(
                       request.files.file.path,
                       function (err, data) {
                         if (err) throw err;
                         console.log("File read!");

                         //Write the file
                         fileSystem.writeFile(
                           filePath,
                           data,
                           async function (err) {
                             if (err) throw err;
                             console.log("File written!");

                             await database.collection("users").updateOne(
                               {
                                 _id: ObjectId(request.session.user._id),
                               },
                               {
                                 $push: {
                                   uploaded: uploadedObj,
                                 },
                               }
                             );

                             result.redirect("/MyUploads/" + _id);
                           }
                         );

                         //Delete the file
                         fileSystem.unlink(
                           request.files.file.path,
                           function (err) {
                             if (err) throw err;
                             console.log("File deleted!");
                           }
                         );
                       }
                     );
                   } else {
                     // if it is a folder
                     var folderObj = await recursiveGetFolder(
                       user.uploaded,
                       _id
                     );

                     uploadedObj.filePath =
                       folderObj.folderPath + "/" + request.files.file.name;

                     var updatedArray = await getUpdatedarray(
                       user.uploaded,
                       _id,
                       uploadedObj
                     );

                     //Read the file
                     fileSystem.readFile(
                       request.files.file.path,
                       function (err, data) {
                         if (err) throw err;
                         console.log("File read!");

                         //Write the file
                         fileSystem.writeFile(
                           uploadedObj.filePath,
                           data,
                           async function (err) {
                             if (err) throw err;
                             console.log("File written!");

                             for (var a = 0; a < updatedArray.length; a++) {
                               updatedArray[a]._id = ObjectId(
                                 updatedArray[a]._id
                               );
                             }

                             await database.collection("users").updateOne(
                               {
                                 _id: ObjectId(request.session.user._id),
                               },
                               {
                                 $set: {
                                   uploaded: updatedArray,
                                 },
                               }
                             );

                             result.redirect("/MyUploads/" + _id);
                           }
                         );

                         //Delete the file
                         fileSystem.unlink(
                           request.files.file.path,
                           function (err) {
                             if (err) throw err;
                             console.log("File deleted!");
                           }
                         );
                       }
                     );
                   }
                 } else {
                   request.status = "error";
                   request.message = "Please select valid image.";

                   result.render("MyUploads", {
                     request: request,
                   });
                 }
                 return false;
               }
               result.redirect("/Login");
             });

             app.post("/CreateFolder", async function (request, result) {
               const name = request.fields.name;
               const _id = request.fields._id;

               if (request.session.user) {
                 var user = await database.collection("users").findOne({
                   _id: ObjectId(request.session.user._id),
                 });

                 var uploadedObj = {
                   _id: ObjectId(),
                   type: "folder",
                   folderName: name,
                   files: [],
                   folderpath: "",
                   createdAt: new Date().getTime(),
                 };

                 var folderPath = "";
                 var updatedArray = [];
                 if (_id == "") {
                   folderPath = "public/uploads/" + user.email + "/" + name;
                   uploadedObj.folderPath = folderPath;

                   if (!fileSystem.existsSync("public/uploads/" + user.email)) {
                     fileSystem.mkdirSync("public/uploads/" + user.email);
                   }
                 } else {
                   var folderObj = await recursiveGetFolder(user.uploaded, _id);
                   uploadedObj.folderPath = folderObj.folderPath + "/" + name;
                   updatedArray = await getUpdatedarray(
                     user.uploaded,
                     _id,
                     uploadedObj
                   );
                 }

                 if (uploadedObj.folderPath == "") {
                   request.session.status = "error";
                   request.session.message = "Folder name must not be empty.";
                   result.redirect("/MyUploads");
                   return false;
                 }

                 if (fileSystem.existsSync(uploadedObj.folderPath)) {
                   request.session.status = "error";
                   request.session.message =
                     "Folder with the same name already exists";
                   result.redirect("/MyUploads");
                   return false;
                 }

                 fileSystem.mkdirSync(uploadedObj.folderPath);

                 if (_id == "") {
                   await database.collection("users").updateOne(
                     {
                       _id: ObjectId(request.session.user._id),
                     },
                     {
                       $push: {
                         uploaded: uploadedObj,
                       },
                     }
                   );
                 } else {
                   for (var a = 0; a < updatedArray.length; a++) {
                     updatedArray[a]._id = ObjectId(updatedArray[a]._id);
                   }

                   await database.collection("users").updateOne(
                     {
                       _id: ObjectId(request.session.user._id),
                     },
                     {
                       $set: {
                         uploaded: updatedArray,
                       },
                     }
                   );
                 }
                 result.redirect("/MyUploads/" + _id);
                 return false;
               }

               result.redirect("/Login");
             });

             app.get("/MyUploads/:_id?", async function (request, result) {
               const _id = request.params._id;
               if (request.session.user) {
                 var user = await database.collection("users").findOne({
                   _id: ObjectId(request.session.user._id),
                 });

                 var uploaded = null;
                 var folderName = "";
                 var createdAt = "";
                 if (typeof _id == "undefined") {
                   uploaded = user.uploaded;
                 } else {
                   var folderObj = await recursiveGetFolder(user.uploaded, _id);

                   if (folderObj == null) {
                     request.status = "error";
                     request.message = "Folder not found.";
                     result.render("MyUploads", {
                       request: request,
                       uploaded: uploaded,
                       _id: _id,
                       folderName: folderName,
                       createdAt: createdAt,
                     });
                     return false;
                   }

                   uploaded = folderObj.files;
                   folderName = folderObj.folderName;
                   createdAt = folderObj.createdAt;
                 }

                 if (uploaded == null) {
                   request.status = "error";
                   request.status = "Directory not found.";
                   result.render("MyUploads", {
                     request: request,
                     uploaded: uploaded,
                     _id: _id,
                     folderName: folderName,
                     createdAt: createdAt,
                   });
                   return false;
                 }
                 result.render("MyUploads", {
                   request: request,
                   uploaded: uploaded,
                   _id: _id,
                   folderName: folderName,
                   createdAt: createdAt,
                 });
                 return false;
               }

               result.redirect("/Login");
             });

             // home page

             app.get("/", function (request, result) {
               console.log("r1");
               result.render("index", {
                 request: request,
               });
             });

             // show page to do the registration
             app.get("/Register", function (request, result) {
               result.render("Register", {
                 request: request,
               });
             });

             app.post("/Register", async function (request, result) {
               var name = request.fields.name;
               var email = request.fields.email;
               var password = request.fields.password;
               var reset_token = "";
               var isVerified = true;
               var verification_token = new Date().getTime();

               var user = await database.collection("users").findOne({
                 email: email,
               });

               if (user == null) {
                 bcrypt.hash(password, 10, async function (error, hash) {
                   await database.collection("users").insertOne(
                     {
                       name: name,
                       email: email,
                       password: hash,
                       reset_token: reset_token,
                       uploaded: [],
                       sharedWithMe: [],
                       isVerified: isVerified,
                       verification_token: verification_token,
                     },
                     async function (error, data) {
                       var transporter =
                         nodemailer.createTransport(nodemailerObject);

                       var text =
                         "Please verfiy your account by click the following link:" +
                         mainURL +
                         "/verifyEmail/" +
                         email +
                         "/" +
                         verification_token;

                       var html =
                         "please verify your account by click the following link :<br><br> <a href='" +
                         mainURL +
                         "/verifyEmail/" +
                         email +
                         "/";
                       verification_token +
                         "'Confim Email</a><br><br>Thank you.";

                       await transporter.sendMail(
                         {
                           from: nodemailerFrom,
                           to: email,
                           subject: "Email Verification",
                           text: text,
                           html: html,
                         },
                         function (error, info) {
                           if (error) {
                             console.error(error);
                           } else {
                             console.log("Email sent : " + info.response);
                           }

                           request.status = "success";
                           request.message =
                             "Signed up successfully. An email has been sent to verify your account. Once verified, you will be able to login and start using file transfer,";

                           result.render("Register", {
                             request: request,
                           });
                         }
                       );
                     }
                   );
                 });
               } else {
                 request.status = "error";
                 request.message = "Email already exist.";

                 result.render("Register", {
                   request: request,
                 });
               }
             });

             app.get(
               "/verfyEmail/:email?:verification_token",
               async function (request, result) {
                 var email = request.params.email;
                 var verification_token = request.params.verification_token;

                 var user = await database.collection("users").findOne({
                   $and: [
                     {
                       email: email,
                     },
                     {
                       verification_token: parseInt(verification_token),
                     },
                   ],
                 });

                 if (user == null) {
                   request.status = "error";
                   request.message =
                     "Email does not exists, Or verification link is expired.";

                   result.render("login", {
                     request: request,
                   });
                 } else {
                   await database.collection("users").findOneAndUpdate(
                     {
                       $and: [
                         {
                           email: email,
                         },
                         {
                           verification_token: parseInt(verification_token),
                         },
                       ],
                     },
                     {
                       $set: {
                         verification_token: "",
                         isVerfied: true,
                       },
                     }
                   );

                   request.status = "success";
                   request.message =
                     "Account has been verified. please try login.";
                   result.render("Login", {
                     request: request,
                   });
                 }
               }
             );

             // show page to login
             app.get("/Login", function (request, result) {
               result.render("Login", {
                 request: request,
               });
             });

             //show our info 
             app.get("/FileTransfer", function (request, result) {
              result.render("FileTransfer", {
                request: request,
              });
            });



             // authenticate the user
             app.post("/Login", async function (request, result) {
               var email = request.fields.email;
               var password = request.fields.password;

               var user = await database.collection("users").findOne({
                 email: email,
               });

               if (user == null) {
                 request.status = "error";

                 request.message = "Email does not exist.";
                 result.render("Login", {
                   request: request,
                 });

                 return false;
               }

               bcrypt.compare(
                 password,
                 user.password,
                 function (error, isVerify) {
                   if (isVerify) {
                     if (user.isVerified) {
                       request.session.user = user;
                       result.redirect("/");

                       return false;
                     }

                     request.status = "error";
                     request.message = "Kindly verify your email.";
                     result.render("Login", {
                       request: request,
                     });
                     return false;
                   }

                   request.status = "error";
                   request.message = "Password is not correct.";
                   result.render("Login", {
                     request: request,
                   });
                 }
               );
             });

             app.get("/ForgotPassword", function (request, result) {
               result.render("ForgotPassword", {
                 request: request,
               });
             });

             app.post("/SendRecoveryLink", async function (request, result) {
               var email = request.fields.email;

               var user = await database
                 .collection("users")
                 .findOne({ email: email });

               if (user == null) {
                 request.status = "error";
                 request.message = "Email does not exists.";

                 result.render("ForgotPassword", {
                   request: request,
                 });

                 return false;
               }
               var reset_token = new Date().getTime();

               await database.collection("users").findOneAndUpdate(
                 {
                   email: email,
                 },
                 {
                   $set: {
                     reset_token: reset_token,
                   },
                 }
               );

               var transporter = nodemailer.createTransport(nodemailerObject);
               var text =
                 "Please click the following link to reset your password: " +
                 mainURL +
                 "/ResetPassword/" +
                 email +
                 "/" +
                 reset_token;
               var html =
                 "Please click the following link to reset your password: <br><br> <a href='" +
                 mainURL +
                 "/ResetPassword/" +
                 email +
                 "/" +
                 reset_token +
                 "'>Reset Password</a> <br><br> Thank you.";

               transporter.sendMail(
                 {
                   from: nodemailerFrom,
                   to: email,
                   subject: "Reset Password",
                   text: text,
                   html: html,
                 },
                 function (error, info) {
                   if (error) {
                     console.error(error);
                   } else {
                     console.log("Email sent: " + info.response);
                   }
                   request.status = "success";
                   request.message =
                     "Email has been sent with the link to recover the password.";
                   result.render("ForgotPassword", {
                     request: request,
                   });
                 }
               );
             });

             app.get(
               "/ResetPassword/:email/:reset_token",
               async function (request, result) {
                 console.log("me haya huuu");
                 var email = request.params.email;
                 var reset_token = request.params.reset_token;
                 var user = await database.collection("users").findOne({
                   $and: [
                     {
                       email: email,
                     },
                     {
                       reset_token: parseInt(reset_token),
                     },
                   ],
                 });

                 if (user == null) {
                   request.status = "error";
                   request.message = "Link is expired.";
                   result.render("Error", {
                     request: request,
                   });

                   return false;
                 }

                 result.render("ResetPassword", {
                   request: request,
                   email: email,
                   reset_token: reset_token,
                 });
               }
             );

             app.post("/resetPassword", async function (request, result) {
               console.log(request.fields);
               var email = request.fields.email;
               var reset_token = request.fields.reset_token;
               var new_password = request.fields.new_password;
               var confirm_password = request.fields.confirm_password;

               if (new_password != confirm_password) {
                 request.status = "error";
                 request.message = "Password does not match.";
                 result.render("ResetPassword", {
                   request: request,
                   email: email,
                   reset_token: reset_token,
                 });
                 return false;
               }

               var user = await database.collection("users").findOne({
                 $and: [
                   {
                     email: email,
                   },
                   {
                     reset_token: parseInt(reset_token),
                   },
                 ],
               });

               if (user == null) {
                 request.status = "error";
                 request.message =
                   "Email does not exists. Or recovery link is expired.";

                 result.render("ResetPassword", {
                   request: request,
                   email: email,
                   reset_token: reset_token,
                 });

                 return false;
               }

               bcrypt.hash(new_password, 10, async function (error, hash) {
                 await database.collection("users").findOneAndUpdate(
                   {
                     $and: [
                       {
                         email: email,
                       },
                       {
                         reset_token: parseInt(reset_token),
                       },
                     ],
                   },
                   {
                     $set: {
                       reset_token: "",
                       password: hash,
                     },
                   }
                 );

                 request.status = "success";
                 request.message =
                   "Password has been changed. Please try login again.";
                 result.render("Login", { request: request });
               });
             });

             // logout the user
             app.get("/Logout", function (request, result) {
               request.session.destroy();
               result.redirect("/");
             });
           });
});