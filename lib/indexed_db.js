
//----------------------------- MANAGE LOCAL DATABASE -----------------------------

let db, transaction;
let indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
let IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction;
let request = indexedDB.open("MyDatabase", 10);
request.onupgradeneeded = function(event) { 
	console.log("request.onupgradeneeded")
	// Save the IDBDatabase interface 
	db = event.target.result;

	// Create an objectStore for this database
	if(!db.objectStoreNames.contains("csv")) {
		console.log("createObjectStore");
		var objectStore = db.createObjectStore("csv");
	}
	setTimer(0); //start download after installation.
	return true;
};
request.onerror = function(event) {
	console.warn("Error indexedDB.open:",request.errorCode);
	setTimer(0); //okay. Let's move on without DB...
};
request.onsuccess = function(e) {
	//console.log("request.onsuccess"); //often
	db = e.target.result;
	db.onerror = function(event) {
		console.warn("Database error: " + event.target.errorCode);
	};
	
	transaction = db.transaction("csv", "readwrite");
	transaction.oncomplete = function(event) {
		//console.log("Transaction complete"); //often
	};
	transaction.onerror = function(event) {
		console.warn("Transaction error:",event);
	};
	//Reading local database
	db.transaction("csv","readwrite").objectStore("csv").get(1).onsuccess=function(e){
		if (!e.target.result) {
			console.log("Local database not found! Update now!");
			setTimer(0); //update immediately!
			return;
		}
		console.log("Databse restored from local cache.");
		update_Database(e.target.result, true);
	}
	//db.transaction("csv","readwrite").objectStore("csv").delete(1)
	//db.transaction("csv","readwrite").objectStore("csv").put("abc",1)
	//db.transaction("csv","readwrite").objectStore("csv").get(1).onsuccess=function(e){console.log(e.target.result)}
};
