/*
Extension downloads database of blocked sites in Russian Federation.
Then it checks URL of each tab.
If URL is blocked, the extension will change icon to red color.
For example:
   rutracker.org is blocked.
   google.com is not blocked.
   www.suicide-forum.com is partially blocked.
Also there is additional info on the icon popup:
   current ip address of a web site.
   all ip addresses of domain (got via dns).
   accessibility of the web site.
   organization which blocked the site.
   reason of block.
*/

function JSON_parse(s) {
	try {
		return JSON.parse(s);
	} catch(e) {
		return {};
	}
}


//------------- CHECK IF SITE IS ONLINE -----------------

let is_up_cache = {}; // {time:123, result:true}
function check_if_is_online(hostname, callback_update_site_status) {
	//console.log("check is online",hostname);
	if (is_up_cache[hostname]) {
		let now = (new Date()).getTime();
		if (now - is_up_cache[hostname].time < 30000) return is_up_cache[hostname].result;
	}
	let xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (this.readyState == 4) { //debug
			if (this.status == 200) ;//console.log("is_up",JSON_parse(xhr.responseText));
			else console.log("is_up ERROR",this.status,xhr.responseText);
		}
		if (this.readyState == 4 && this.status == 200) {
			//console.log("success");
			let result;
			if (xhr.responseText.indexOf('looks down from here') > -1 || xhr.responseText.indexOf("It's not just you!") > -1) { //down
				result = false;
			} else if (xhr.responseText.indexOf(' is up') > -1 || xhr.responseText.indexOf("It's just you.") > -1) { //up
				result = true;
			} else result = "?";
			is_up_cache[hostname] = {
				time: (new Date()).getTime(),
				result: result,
			}
			try {
				callback_update_site_status(result);
			} catch(e) {
				//window dead (firefox)
			}
		}
	};
	xhr.open("GET", 'https://downforeveryoneorjustme.com/'+hostname, true);
	xhr.send();
}

//-------------------------DNS--------------------------

if (localStorage.httpdns === undefined) localStorage.httpdns = 0;

let dns_cache = {}
function getDNS(domain,callback) {
	//if (!callback) callback=updateIcon;
	//console.log('getDNS',domain);
	if(!domain)return;
	let now = (new Date()).getTime();
	let rec = dns_cache[domain];
	if (rec && (now - rec.time < 360000*2)) return callback(rec); //let other users use this free service
	let xhr = new XMLHttpRequest();
	if (localStorage.httpdns == 2) { //dns-api.org
		xhr.onreadystatechange = function() {
			if (this.readyState == 4) { //debug
				if (this.status == 200) ;//console.log("getDNS",JSON_parse(xhr.responseText));
				else console.log("getDNS ERROR",this.status,xhr.responseText);
			}
			if (this.readyState == 4 && this.status == 200) {
				//console.log("success");
				try {
					let arr = JSON.parse(xhr.responseText);
					if (!rec) {
						rec={};
						dns_cache[domain]=rec;
					}
					rec.ip = {};
					rec.time = now;
					//if (!arr.length) return; //keep empty record in cache. Don't update it until timeout.
					for(let i=0;i<arr.length;i++) {
						let ip = arr[i].value;
						if (ip && arr[i].type == "A") {
							rec.ip[ip] = check_ip(ip);
						}
					}
					callback(rec);
				} catch(e) {
					//if (rec) callback(); //use old data
					//callback(); //anyway
				}
			}
		};
		xhr.open("GET", 'https://dns-api.org/A/'+domain, true);
	} else if (localStorage.httpdns == 1) {
		xhr.onreadystatechange = function() {
			if (this.readyState == 4 && this.status != 200)
				console.log("getDNS ERROR",this.status,xhr.responseText);
			if (this.readyState == 4 && this.status == 200) {
				try {
					let arr = JSON.parse(xhr.responseText);
					if (!rec) {
						rec={};
						dns_cache[domain]=rec;
					}
					rec.ip = {};
					rec.time = now;
					//if (!arr.length) return; //keep empty record in cache. Don't update it until timeout.
					for(let i=0;i<arr.length;i++) {
						let ip = arr[i];
						rec.ip[ip] = check_ip(ip);
					}
					callback(rec);
				} catch(e) {
				}
			}
		};
		xhr.open("GET", 'http://dns.bermap.ru/?key=2F3468E768AE36F5345C375EF172F21FA2C6390&host='+domain+'&type=A', true);
	} else { //google
		xhr.onreadystatechange = function() {
			if (this.readyState == 4 && this.status != 200)
				console.log("getDNS ERROR (google)",this.status,xhr.responseText);
			if (this.readyState == 4 && this.status == 200) {
				try {
					const o = JSON.parse(xhr.responseText);
					const arr = o.Answer;
					if (o.Status != 0 || arr.length === undefined) return console.log('google dns error:',xhr.responseText);
					if (!rec) {
						rec={};
						dns_cache[domain]=rec;
					}
					rec.ip = {};
					rec.time = now;
					//if (!arr.length) return; //keep empty record in cache. Don't update it until timeout.
					for(let i=0;i<arr.length;i++) {
						let ip = arr[i].data;
						if (arr[i].type == 1) {
							rec.ip[ip] = check_ip(ip);
						}
					}
					callback(rec);
				} catch(e) {
				}
			}
		};
		xhr.open("GET", 'https://dns.google.com/resolve?name='+domain+'&type=A', true);
	}
	xhr.send();
	//console.log('send');
}


var known_proxy_name = ['','Прокси от ValdikSS','RuTracker Proxy','anonymoX Proxy'];
//proxy ips
var known_proxy_ip = {
	//proxy.antizapret.prostovpn.org
	"195.123.214.52":1, "195.123.214.53":1, "195.123.214.54":1, "54.37.137.152":1,
	"54.37.137.153":1, "137.74.171.91":1, "163.172.173.40":1, "185.14.31.172":1,
	//rutracker
	'195.82.146.20':2,
}
function check_proxy_ip() {
	getDNS('proxy.antizapret.prostovpn.org',function(rec){
		for(let ip in rec.ip) known_proxy_ip[ip] = 1;
	})
}
setInterval(check_proxy_ip, 24 * 60 * 60 * 1000);
check_proxy_ip();




//------------------------------- MANAGE URLS AND DOMAINS --------------------------------

//syntax errors
function fixIP(ip) {
	let a = ip.split('/');
	let parts = a[0].split('.');
	while (parts.length < 4) parts.push('0');
	return parts.join('.') + (a[1] ? '/' + a[1] : '');
}

//Hostname without "www"
let real_domain = '';
function extractHostname(url) {
    var hostname;
    if (url.indexOf("//") > -1) {
        hostname = url.split('/')[2];
    }
    else {
        hostname = url.split('/')[0];
    }
    hostname = hostname.split(':')[0];
    hostname = hostname.split('?')[0];
	if (hostname.indexOf('\\') > -1) { //cover known URL bug.
		hostname = hostname.split('\\')[0];
	}
	if (hostname[hostname.length-1] == ".") hostname = hostname.substr(0, hostname.length-1);
	real_domain = hostname;
	if (hostname.substr(0,4) == "www.") hostname = hostname.substr(4, hostname.length-4);
    return hostname;
}

let rus_domains = { //russian root domains
	"abkhazia.su":1, "adygeya.ru":1, "adygeya.su":1, "aktyubinsk.su":1,
	"arkhangelsk.su":1, "armenia.su":1, "ashgabad.su":1, "azerbaijan.su":1,
	"balashov.su":1, "bashkiria.ru":1, "bashkiria.su":1, "bir.ru":1,
	"bryansk.su":1, "bukhara.su":1, "cbg.ru":1, "chimkent.su":1,
	"dagestan.ru":1, "dagestan.su":1, "east-kazakhstan.su":1, "exnet.su":1,
	"georgia.su":1, "grozny.ru":1, "grozny.su":1, "ivanovo.su":1,
	"jambyl.su":1, "kalmykia.ru":1, "kalmykia.su":1, "kaluga.su":1,
	"karacol.su":1, "karaganda.su":1, "karelia.su":1, "khakassia.su":1,
	"krasnodar.su":1, "kurgan.su":1, "kustanai.ru":1, "kustanai.su":1,
	"lenug.su":1, "mangyshlak.su":1, "marine.ru":1, "mordovia.ru":1,
	"mordovia.su":1, "msk.ru":1, "msk.su":1, "murmansk.su":1, "mytis.ru":1,
	"nalchik.ru":1, "nalchik.su":1, "navoi.su":1, "north-kazakhstan.su":1,
	"nov.ru":1, "nov.su":1, "obninsk.su":1, "penza.su":1, "pokrovsk.su":1,
	"pyatigorsk.ru":1, "ru.com":1, "ru.net":1, "sochi.su":1, "spb.ru":1,
	"spb.su":1, "tashkent.su":1, "termez.su":1, "togliatti.su":1,
	"troitsk.su":1, "tselinograd.su":1, "tula.su":1, "tuva.su":1,
	"vladikavkaz.ru":1, "vladikavkaz.su":1, "vladimir.ru":1, "vladimir.su":1,
	"vologda.su":1, 
}
function extractRootDomain(url) {
    var domain = extractHostname(url),
        splitArr = domain.split('.'),
        arrLen = splitArr.length;

    if (arrLen > 2) {
        domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
		let sub_dom = splitArr[arrLen - 2];
        if (
			((sub_dom.length == 2 || sub_dom == "net" || sub_dom == "org" || sub_dom == "com")
				&& splitArr[arrLen - 1].length == 2)
			|| rus_domains[domain]
		)
		{
            domain = splitArr[arrLen - 3] + '.' + domain;
        }
    }
    return domain;
}


function decode(encoded) {
	return decodeURIComponent(encoded);
	//return decodeURIComponent(encoded.replace(/\+/g,  " "));
}

function parse_custom_provider_stub(new_stub) {
	localStorage.custom_provider_stub = extractHostname(new_stub); //w/o www
}

let saved_last_url = []; // index - tabId, value - string
let extracted_blocked_ip;
let is_bad_url = false;
let easy_provider_stub_list = {
	'blackhole.beeline.ru':1, 'warning.rt.ru':1, 'blocked.mts.ru':1,
	'lawfilter.ertelecom.ru':1, 'forbidden.yota.ru':1, 'fz139.ttk.ru':1,
}
//Check if URL is stub of a popular Internet provider. If so, extract blocked domain and may be blocked ip.
function parseStub(url, tabId) {
	extracted_blocked_ip = ''; //reset ip
	is_bad_url = true;
	if (url.indexOf('//77.37.254.90/zapret/') > -1) { //Onlime (Rostelecom)
		let arr = /[?&]{1}sa=(\d+\.\d+\.\d+\.\d+)/.exec(url);
		if (arr!=null) extracted_blocked_ip = arr[1];
		arr = /[?&]{1}url=([^&?]+)/.exec(url);
		if (arr!=null) return decode(arr[1]);
		return '';
	}
	let domain = extractHostname(url)
	if (domain == 'blackhole.beeline.ru') { //blackhole.beeline.ru/?url=rutracker.org%2F
		let arr = /[?&]{1}url=([^&?]+)/.exec(url);
		if (arr!=null) return decode(arr[1]);
		//return '';
	}
	if (domain == 'warning.rt.ru' || domain == "95.167.13.50" || domain == "95.167.13.51") { 
		//warning.rt.ru/?id=13&st=0&dt=195.82.146.214&rs=http%3A%2F%2Frutracker.org%2F
		let arr = /[?&]{1}dt=(\d+\.\d+\.\d+\.\d+)/.exec(url);
		if (arr!=null) extracted_blocked_ip = arr[1];
		arr = /[?&]{1}rs=([^&?]+)/.exec(url);
		if (arr!=null) return decode(arr[1]);
		//return '';
	}
	if (domain == 'blocked.mts.ru') { //http://blocked.mts.ru/info?host=rutracker.org http://blocked.mts.ru/?host=rutracker.org
		//blocked.mts.ru/?host=?url=http%3A%2F%2Frutracker.org%2F&ip=195.82.146.214
		let arr = /&ip=(\d+\.\d+\.\d+\.\d+)/.exec(url);
		if (arr!=null) extracted_blocked_ip = arr[1];
		arr = /[?&]{1}url=([^&?]+)/.exec(url);
		if (arr!=null) return decode(arr[1]);
		arr = /[?&]{1}host=([^&?]+)/.exec(url);
		if (arr!=null) return decode(arr[1]);
		//return '';
	}
	//if (domain == '') { //http://fz139.ttk.ru/?order=решение%20суда%20по%20делу%20№%203-0726/2015&org=Мосгорсуд&date=2015-12-04&id=262698
		//no domain info
	//}
	if (url.indexOf('/freedom-vrn.ru/support/block.html') > -1
		|| (domain=='milecom.ru' && url.indexOf('milecom.ru/zapret.htm') > -1)
		|| url.indexOf('/sovatelecom.ru/ZAPRET.html') > -1
		|| (domain=='tmpk.net' && url.indexOf('tmpk.net/rpn/') > -1)
		|| easy_provider_stub_list[domain]
		|| (domain && domain == localStorage.custom_provider_stub)
		)
	{
		//if info is not provided, try to remember what last domain was
		if (tabId && saved_last_url[tabId]) return saved_last_url[tabId]; //return old url if exists
		return '';
	}
	is_bad_url = false;
	return url;
}


var permanently_blocked = {
	'kinogo.co':1, 'bobfilm.net':1, 'dream-film.net':1, 'kinokubik.com':1, 'kinozal.tv':1,
	'kinobolt.ru':1, 'rutor.org':1, 'seedoff.net':1, 'torrentor.net':1, 'tushkan.net':1,
	'tvserial-online.net':1, 'wood-film.ru':1, 'kinovo.tv':1, 'bigcinema.tv':1,
	'rutracker.org':1,
	'nnm-club.me':1,
}

//----------------------------- MANAGE ICON -----------------------------

let anim_icon_num = 0;
let anim_icon_data = [1,2,1,2,1,3];
let anim_icon_timer;
function animateIcon() { //green status of downloading file
	if (!anim_icon_timer) {
		anim_icon_num = 0;
		anim_icon_timer = setInterval(animateIcon, 200);
	}
	chrome.browserAction.setIcon({path: "images/anim0"+anim_icon_data[anim_icon_num]+".png"});
	anim_icon_num++;
	if (anim_icon_num >= anim_icon_data.length) anim_icon_num = 0;
}

var popup_update_unsafe = function(){}; //Blank. Do nothing (popup doesn't exist yet).
var options_update_unsafe = popup_update_unsafe; //Blank. Will be callback function from options.

function popup_update() {
	try { popup_update_unsafe() } catch(e) {}
}
function options_update() {
	try { options_update_unsafe() } catch(e) {}
}

var options_hint = {}

var icon_hint = {no_init:true}
let icon_urls;
let icon_domain;

function windows_update() {
	popup_update();
	options_update();
}

function test_domain_mask(domain,masks) {
	let arr_name = domain.split(".");
	while (arr_name.length > 0) {
		let test_domain = arr_name.join(".");
		if (masks[test_domain]) return test_domain;
		arr_name.splice(0,1);
	}
	return false;
}

let whitelist_ip_local_arr = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.1/24'];
let arr_special_url = {'about':1, };
chrome.browserAction.setBadgeBackgroundColor({color:"#777"});
function updateIcon(url, tabId) {
	if (options_hint.is_updating && localStorage.show_updating == 1) {
		animateIcon();
		icon_hint = {replace_text:'Скачивание базы реестра...'};
		return popup_update();
	}
	if (anim_icon_timer) {
		clearInterval(anim_icon_timer);
		anim_icon_timer = undefined;
	}
	if (url === undefined) { //updateIcon()
		try { //FireFox
			browser.tabs.query({active: true}).then(tabs => {
				for (let tab of tabs) {
					if (tab.url === undefined) return;
					//console.log(tab.url)
					updateIcon(tab.url, tab.id);
				}
			},function(){});
			return;
		} catch(e) { //Chrome
			return chrome.tabs.getSelected(null, function(tab){ //getSelected deprecated!
				if (tab.url === undefined) return;
				updateIcon(tab.url, tab.id);
			});
		}
	}

	url = parseStub(url, tabId);
	//chrome.browserAction.setIcon({imageData:canvasContext.getImageData(0, 0, canvas.width,canvas.height)});
	icon_hint = {}; //reset icon info.
	chrome.browserAction.setBadgeText({text:""});
	//console.log("url:",url);
	if (!url) {
		chrome.browserAction.setIcon({path: "images/circ_gray_gray_16.png"});
		return windows_update();
	}
	if (url.substr(0,4) != "http" && url.indexOf('//') > -1) { // && url.substr(0,5) != "https"
		chrome.browserAction.setIcon({path: "images/circ_gray_gray_16.png"});
		//console.log(icon_hint);
		return windows_update();
	}
	if (tabId && !is_bad_url) saved_last_url[tabId] = url;
	
	let domain = extractHostname(url);
	
	if (arr_special_url[domain]) { // about:addons in FireFox
		chrome.browserAction.setIcon({path: "images/circ_gray_gray_16.png"});
		return windows_update();
	}
	
	if (domain=='localhost') icon_hint.is_whitelist_ip_local = true;

	options_hint.urls = undefined;
	options_hint.domain = undefined;
	options_update();
	
	if (permanently_blocked[domain]) icon_hint.permanently_blocked = true;
	
	icon_hint.hostname = decode_domain(real_domain);
	let ip, info = save_info_ip[real_domain];
	//console.log("info",tabId,info);
	if (info && tabId) {
		ip = info.tab_ip[tabId];
		icon_hint.ip_info = info;
	}
	else if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
		ip = domain;
		icon_hint.ip_info = save_info_ip[ip];
	}
	//if (!ip && extracted_blocked_ip) ip = extracted_blocked_ip; //info from provider!..
	if (ip) {
		icon_hint.ip = ip;
		if (!info) info = {ip:{[ip]:check_ip(ip)},reason:{[ip]:blocked_ip_reason}};
		icon_hint.ip_info = info;
		//ip in whitelist?
		if (whitelist.ip[ip] || isIp4InCidrs(ip,whitelist.ip_range)) icon_hint.is_whitelist_ip = true;
		if (isIp4InCidrs(ip,whitelist_ip_local_arr)) icon_hint.is_whitelist_ip_local = true;
	}
	
	//domain in white list?
	if (whitelist.domain[domain] || test_domain_mask(domain,whitelist.domain_mask)) icon_hint.is_whitelist_domain = true;
	if (whitelist.domain[icon_hint.hostname] || test_domain_mask(icon_hint.hostname,whitelist.domain_mask)) icon_hint.is_whitelist_domain = true;
	
	let rec = database.blocked_domain[domain];
	if (!rec) {
		//check mask: *.example.com (in db it will be "example.com")
		let test_domain = test_domain_mask(domain,database.blocked_mask);
		if (test_domain) {
			chrome.browserAction.setIcon({path: "images/circ_pink_red_16.png"});
			icon_hint.date = database.blocked_mask[test_domain];
			icon_hint.text = "Заблокирована группа доменов *." + test_domain;
			icon_hint.reason = database.blocked_mask_reason[test_domain];
			return windows_update();
		}
		let is_whitelist = icon_hint.is_whitelist_domain || icon_hint.is_whitelist_ip || icon_hint.is_whitelist_ip_local;
		//Check blocked ip
		if (ip && info.ip[ip] > 0) {
			let status = info.ip[ip];
			if (status == 2) {
				icon_hint.text = "Сайт заблокирован по ip";
				chrome.browserAction.setIcon({path: "images/circ_yellow_red_16.png"});
			}
			else if (status == 1) {
				if (!icon_hint.is_whitelist_ip_local) icon_hint.text = "Некоторые провайдеры блокируют этот сайт по ip";
				if (is_whitelist)
					//in whitelist (ignore status 1):
					chrome.browserAction.setIcon({path: "images/circ_whitelist_16.png"});
				else
					chrome.browserAction.setIcon({path: "images/circ_green_yellow_16.png"});
			}
			else chrome.browserAction.setIcon({path: "images/circ_unknown_16.png"});
			return windows_update();
		}
		//No block
		if (is_whitelist) { //in whitelist:
			chrome.browserAction.setIcon({path: "images/circ_whitelist_16.png"});
		} else { //Green icon:
			chrome.browserAction.setIcon({path: "images/circ_green_green_16.png"});
		}
		return windows_update();
	}
	if (rec.urls.length > 0) {
		chrome.browserAction.setBadgeText({text:""+rec.urls.length});
		options_hint.urls = rec.urls;
		options_hint.domain = domain;
		options_update();
		//console.log(icon_hint);
	}
	
	let find_url = url.substr(0,5) == "https" ? url.substr(8, url.length-8) : url.substr(7, url.length-7);
	//console.log("find_url",find_url);
	if (database.blocked_url[find_url]) {
		icon_hint.date = database.blocked_url[find_url];
		icon_hint.reason = database.blocked_url_reason[find_url];
		if (rec.blocked) {
			chrome.browserAction.setIcon({path: "images/circ_red_red_16.png"});
		}
		else {
			chrome.browserAction.setIcon({path: "images/circ_red_white_16.png"});
			icon_hint.text = "URL заблокирован, но домен разрешён.";
		}
		return windows_update();
	}
	if (rec.blocked) {	
		if (!icon_hint.date) icon_hint.date = rec.date;
		if (rec.postanovlenie && !icon_hint.reason) icon_hint.reason = {
			postanovlenie: rec.postanovlenie,
			gos_organ: rec.gos_organ,
		};
		chrome.browserAction.setIcon({path: "images/circ_pink_red_16.png"});
		return windows_update();
	}
	//not blocked, but there are blocked URLs
	chrome.browserAction.setIcon({path: "images/circ_orange_green_16.png"});
	icon_hint.text = "На сайте есть заблокированные URL.";
	windows_update();
}

let is_icon_handlers;
function InitializeIconHandlers() {
	if (is_icon_handlers) return;
	is_icon_handlers = true;
	chrome.tabs.onActivated.addListener(function(activeInfo) {
		chrome.tabs.get(activeInfo.tabId, function(tab) {
			if (!tab) {
				let e = chrome.runtime.lastError;
				return;
			}
			//console.log("onActivated",activeInfo.tabId,tab.url,tab);
			updateIcon(tab.url, tab.id);
		})
	});
	chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
		if (changeInfo.url) {
			if (tab.active) {
				//console.log("onUpdated",tabId,changeInfo.url);
				updateIcon(changeInfo.url, tabId);
			}
			else {
				let test_url = parseStub(changeInfo.url)
				if (!is_bad_url) {
					saved_last_url[tabId] = changeInfo.url;
				}
			}
		}
	})
	chrome.tabs.onCreated.addListener(function(tab) {
		//console.log("onCreated",tab);
		saved_last_url[tab.id] = tab.url;
	})
	chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
		//console.log("onRemoved",tabId,removeInfo);
		delete saved_last_url[tabId];
	})
}

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


// --------------------------- DOWNLOADING DATABASE ------------------------

//let start = ((new Date()).getTime() / 1000);
let xhttp;
function load_String_From_URL(url, callback_finished, callback_loading, on_success, on_fail, windows1251) {
	xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		//let now = ((new Date()).getTime() / 1000);
		//console.log((now-start).toFixed(2),"Stage:", this.readyState, this.status);
		if (this.readyState == 4 && this.status == 200) {
			console.log("Loaded:", url);
			if (callback_finished) {
				if ("string" == typeof callback_finished) {
					window[callback_finished] = xhttp.responseText; //debug in console
				} else {
					let result = callback_finished(xhttp.responseText);
					if (result !== true) {
						if (on_fail) on_fail(result);
					}
					else if (on_success) on_success();
				}
			}
			//jj: what if no callback...
		}
		else if (callback_loading !== undefined) callback_loading(xhttp, this.readyState, this.status);
		if (this.readyState == 4 && this.status != 200) {
			console.log('xhr error:',this.status);
			if (on_fail) on_fail(xhttp.responseText)
		}
	};
	xhttp.open("GET", url, true);
	if (windows1251) {
		xhttp.overrideMimeType('text/plain; charset=windows-1251');
	}
	xhttp.send();
}

let database;

function reset_Database() {
	database = {
		blocked_ip: {},
		blocked_ip_range: [], // e.g.  1.2.3.4/24
		blocked_site_ip: {}, //domain is already blocked but there is list of ips for poor providers
		blocked_ip_reason: {}, // ip => {postanovlenie:'',gos_organ:'',mask:'1.2.3.4/24'}
		blocked_domain: {},
		blocked_mask: {},
		blocked_mask_reason: {}, // domain w/o "*." => {postanovlenie:'',gos_organ:'',}
		blocked_url: {},
		blocked_url_reason: {}, // url => {postanovlenie:'',gos_organ:'',}
	};
}
reset_Database();

let db_updated_date = 0; //session update timestamp
if (localStorage['db_updated_date']) db_updated_date = localStorage['db_updated_date'];
//Parse csv file and update database of blocked sites.
let test_csv;
function update_Database(csv, no_save) {
	test_csv = csv;
	//return "Skip";
	let start_updating_tm = (new Date()).getTime();
	if (csv.length < 10) return "No result"; //no result
	let cnt_records = 0;
	if (csv[0] == '{') { //JSON data
		let json, row, base_date, json_type;
		if (csv.substr(0,12) == '{"updateTime') json_type = "AZP";
		if (json_type == "AZP") { //Antizapret
			//fixing json syntax errors.
			csv = csv.replace(/([^\\])\\\"([^,][^\"])/g,'$1$2').replace(/([^\\])\\([^\\])/g,'$1\\\\$2').replace(/([^\\])\\([^\\])/g,'$1\\\\$2')
			json = JSON_parse(csv);
			base_date = json.updateTime;
			row = json.register;
			if (!(base_date && row)) {
				console.log('Error in JSON AZP',csv.substr(0,1000));
				return 'Error in JSON AZP';
			}
		}
		else { //Rublacklist
			json = JSON_parse(csv);
			let cnt = 0;
			for (let date in json) {
				cnt++;
				base_date = date;
				row = json[date];
			}
			if (cnt > 1 || !row || !Array.isArray(row) || row.length < 1000) { //Error in json structure
				console.log('Error in json structure',csv.substr(0,1000));
				return 'Error in json structure';
			}
		}
		let cnt = row.length;
		let check_row = function(obj) {
			if(obj===null || typeof obj != "object")return;
			if(obj.postanovlenie && obj.gos_organ
				&& obj.ip && typeof obj.link == "string" && obj.date && typeof obj.page == "string"
				&& Array.isArray(obj.ip)) return "RBL";
			if(obj.includeTime && obj.org && obj.org_act && typeof obj.url == "string"
				&& typeof obj.domain == "string" && typeof obj.ip == "string") return "AZP";
		}
		let cnt_good = 0;
		for (let i=1;i<1000;i++) {
			if (check_row(row[i])) cnt_good++;
		}
		if (cnt_good < 950) {
			console.warn('Error in json row structure of database!');
			return 'Error in json row structure of database!';
		}
		reset_Database();
		for (let i=0; i<cnt; i++) {
			let o = row[i];
			if (!check_row(o)) {
				console.log("Json row error:",o);
				continue;
			}
			/* o format:
			{
			  "postanovlenie": "2-6-27/2016-04-01-16-\\u0410\\u0418",
			  "ip": [
				"104.31.66.12",
				"104.31.67.12"
			  ],
			  "gos_organ": "\\u0424\\u041d\\u0421",
			  "link": "",
			  "date": "2016-04-22",
			  "page": "360joycasino.com"
			}*/
			let blocked_date = o.date || o.includeTime && o.includeTime.substr(0,10);
			let urls = o.link || o.url;
			let domain = o.page && extractHostname(o.page) || o.domain && extractHostname(o.domain);
			//if (!domain) console.log('No domain!',o);
			if (typeof o.ip == "string") {
				o.ip = o.ip.split(","); //make an array
				if (o.ip[0] === '') { //will be ipv6 in future.
					o.ip=[];
					//console.log('empty ip list',domain); 
				}
			}
			if ((urls || domain) && o.ip.length) {
				let arr_ip = o.ip;
				let cnt_ip = arr_ip.length;
				for (let i=0; i<cnt_ip; i++) {
					if (arr_ip[i].indexOf('/') > -1) console.warn("Error in minor ip, it should not be range:",arr_ip[i]);
					else database.blocked_site_ip[arr_ip[i]] = true;
				}
			}
			if (urls) { //url
				let arr_url = urls.split(",http"); //and https
				if (arr_url.length > 1) for(let j=1; j<arr_url.length; j++) {
					arr_url[j] = "http" + arr_url[j];
					//if (arr_url[j].indexOf(',') > -1) console.warn("Error ',' in URL:",arr_url[j]);
				}
				cnt_records += arr_url.length;
				//if (urls.indexOf(",")>-1) console.log(urls);
				for (let i=0; i<arr_url.length; i++) {
					let url = arr_url[i];
					if (!domain) { //cover possible csv error
						domain = extractHostname(url).toLowerCase(); 
						console.warn('Error no domain:',o);
					}
					
					if (domain != extractHostname(url).toLowerCase()) { //cover known csv bug
						let url_domain = extractHostname(url).toLowerCase();
						//console.warn('Error in domain:', domain, url_domain);
						if (!database.blocked_domain[domain]) { //Add a record for this domain. It's possibly blocked.
							database.blocked_domain[domain] = {
								blocked: false,
								date: blocked_date,
								urls: [],
								//postanovlenie: o.postanovlenie || o.org_act,
								//gos_organ: o.gos_organ || o.org,
							};
						}
						domain = url_domain;
					}
					
					if (!database.blocked_domain[domain]) {
						database.blocked_domain[domain] = {
							blocked: false,
							date: blocked_date,
							urls: [],
							//postanovlenie: o.postanovlenie || o.org_act,
							//gos_organ: o.gos_organ || o.org,
						};
					}
					let rec = database.blocked_domain[domain];
					
					if (url.substr(0,2) == '\\"') { //cover known json bug
						url = url.substr(2, url.length-2);
					}
					if (url.substr(0,7) == 'http://') url = url.substr(7, url.length-7);
					else if (url.substr(0,8) == 'https://') url = url.substr(8, url.length-8);
					else {
						//console.warn('Bad url:',url);
						continue;
					}
					
					if ((domain == url || domain+"/" == url) && !rec.blocked) { //cover known json inaccuracy
						rec.blocked = true;
						rec.postanovlenie = o.postanovlenie || o.org_act;
						rec.gos_organ = o.gos_organ || o.org;
						//console.warn('RKN domain inaccuracy:',url);
						continue;
					}

					
					if ((!rec.blocked) && blocked_date < rec.date) rec.date = blocked_date;
					if (database.blocked_url[url]) {
						if (blocked_date < database.blocked_url[url]) database.blocked_url[url] = blocked_date;
					}
					else {
						database.blocked_url[url] = blocked_date;
						database.blocked_url_reason[url] = {
							postanovlenie: o.postanovlenie || o.org_act,
							gos_organ: o.gos_organ || o.org,
						};
						rec.urls.push(url);
					}
				}
			}
			else if (domain) { //URL doesn't exist but domain exists. Type of block: by domain.
				if (domain.indexOf(',')>-1) console.log('Complex domain:',domain);
				if (domain[0] == "*") { //*.example.com
					let mask = domain.substr(2,domain.length-2);
					database.blocked_mask[mask] = blocked_date;
					database.blocked_mask_reason[mask] = {
						postanovlenie: o.postanovlenie || o.org_act,
						gos_organ: o.gos_organ || o.org,
					};
					cnt_records++;
				}
				else if (!database.blocked_domain[domain]) {
					database.blocked_domain[domain] = {
						blocked: true,
						date: blocked_date,
						urls: [],
						postanovlenie: o.postanovlenie || o.org_act,
						gos_organ: o.gos_organ || o.org,
					};
					cnt_records++;
				}
				else {
					let rec = database.blocked_domain[domain];
					if (rec.blocked) {
						if (blocked_date < rec.date) rec.date = blocked_date;
					}
					else {
						rec.date = blocked_date;
						rec.blocked = true;
						rec.postanovlenie = o.postanovlenie || o.org_act;
						rec.gos_organ = o.gos_organ || o.org;
					}
				}
			}
			else if (o.ip) { //array of ip
				let arr_ip = o.ip;
				let cnt_ip = arr_ip.length;
				cnt_records += cnt_ip;
				for (let i=0; i<cnt_ip; i++) {
					let ip = arr_ip[i];
					if (ip.indexOf('/') > -1) {
						if(!/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(ip)) ip = fixIP(ip);
						database.blocked_ip_range.push(ip);
					}
					else {
						if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) ip= fixIP(ip);
						database.blocked_ip[ip] = true;
					}
					database.blocked_ip_reason[ip] = {
						postanovlenie: o.postanovlenie,
						gos_organ: o.gos_organ,
					};
					//if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip) && !/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(ip)) console.warn('Bad ip:',ip);
				}
			}
		}
		localStorage['Antizapret_updateTime'] = base_date;
		//end of json parse
	}
	else if (csv.substr(0,8) == 'Updated:') { //csv format
		//Fixing encoding...
		//Content-Type: text/plain; charset=utf-8 - WRONG! Windows-1251? Really??
		if (TextDecoder) {
			
		}
		let row = csv.split("\n");
		let cnt = row.length;
		if (cnt < 1000) { //Error in database! 
			return 'Error in database!';
		}
		//check db format
		let cnt_good = 0;
		for (let i=0;i<1000;i++) {
			if (row[i].split(';').length >= 6) cnt_good++;
		}
		if (cnt_good < 950) { //Error in database! Wrong format;
			//Probably 404 or 500 or something like that.
			return 'Error in database! Wrong format';
		}
		let base_date = row[0].substr(9,row[0].length-9);
		if (!/^\d{4}-\d{2}-\d{2}/.test(base_date)) {
			return 'Error in database! Wrong date format: '+row[0];
		}
		reset_Database();
		for (let i=1; i<cnt; i++) {
			let data = row[i].split(';');
			if (data.length != 6) {
				if (data.length > 6) { //fix a known bug in the csv file: symbols ";" in url.
					let restore_url = data.splice(2, data.length - 5).join(';');
					data.splice(2, 0, restore_url);
					//console.warn("Complex data!",row[i]);
					let check_quotes = /^\"(.*)\"$/.exec(data[2]);
					if (check_quotes) data[2] = check_quotes[1];
				}
				else { //unknown bug
					if (data[0]) console.warn('Error: ',row[i]);
					continue;
				}
			}
			//format: [0] - date; [1] - array of urls; [2] - domain; [3] - array of ip
			let blocked_date = data[5];
			let urls = data[2];
			let domain = extractHostname(data[1]);
			let postanovlenie = data[4];
			let gos_organ = data[3];
			if ((urls || domain) && data[0]) {
				let arr_ip = data[0].split(" | ");
				let cnt_ip = arr_ip.length;
				for (let i=0; i<cnt_ip; i++) {
					if (arr_ip[i].indexOf('/') > -1) console.warn("Error in minor ip, it should not be range:",arr_ip[i]);
					else database.blocked_site_ip[arr_ip[i]] = true;
				}
			}
			if (urls) { //url
				//if (urls.indexOf(' | ')>-1) console.warn('Complex URL!',urls);
				let arr_url = urls.split(" | ");
				/*if (arr_url.length > 1) {
					//console.warn('Strange URL:',urls);
					for(let j=1; j<arr_url.length; j++) {
						arr_url[j] = "http" + arr_url[j];
						//if (arr_url[j].indexOf(',') > -1) console.warn("Error ',' in URL:",arr_url[j]);
					}
				}*/
				cnt_records += arr_url.length;
				for (let i=0; i<arr_url.length; i++) {
					let url = arr_url[i];
					if (!domain) { //cover possible csv error
						domain = extractHostname(url).toLowerCase(); 
						//console.warn('Error no domain:',row[i]);
					}
					
					if (domain != extractHostname(url).toLowerCase()) { //cover known csv bug
						let url_domain = extractHostname(url).toLowerCase();
						console.warn('Error in domain:', domain, url_domain);
						if (!database.blocked_domain[domain]) { //Add a record for this domain. It's possibly blocked.
							database.blocked_domain[domain] = {
								blocked: false,
								date: blocked_date,
								urls: [],
							};
						}
						domain = url_domain;
					}
					
					if (!database.blocked_domain[domain]) {
						database.blocked_domain[domain] = {
							blocked: false,
							date: blocked_date,
							urls: [],
						};
					}
					let rec = database.blocked_domain[domain];
					
					if (url.substr(0,7) == 'http://') url = url.substr(7, url.length-7);
					else if (url.substr(0,8) == 'https://') url = url.substr(8, url.length-8);
					else {
						//console.warn('Bad url:',url); //jj: shouldn't skip non-standard urls
						continue;
					}
					
					if ((domain == url || domain+"/" == url) && !rec.blocked) { //cover known json inaccuracy
						rec.blocked = true;
						rec.postanovlenie = postanovlenie;
						rec.gos_organ = gos_organ;
						//console.warn('RKN domain inaccuracy:',url);
						continue;
					}
					
					
					if ((!rec.blocked) && blocked_date < rec.date) rec.date = blocked_date;
					if (database.blocked_url[url]) {
						if (blocked_date < database.blocked_url[url]) database.blocked_url[url] = blocked_date;
					}
					else {
						database.blocked_url[url] = blocked_date;
						database.blocked_url_reason[url] = {
							postanovlenie: postanovlenie,
							gos_organ: gos_organ,
						};
						rec.urls.push(url);
					}
				}
			}
			else if (domain) { //URL doesn't exist but domain exists. Type of block: by domain.
				if (domain[0] == "*") { //*.example.com
					let mask = domain.substr(2,domain.length-2);
					database.blocked_mask[mask] = blocked_date;
					database.blocked_mask_reason[mask] = {
						postanovlenie: postanovlenie,
						gos_organ: gos_organ,
					};
					cnt_records++;
				}
				else if (!database.blocked_domain[domain]) {
					database.blocked_domain[domain] = {
						blocked: true,
						date: blocked_date,
						urls: [],
						postanovlenie: postanovlenie,
						gos_organ: gos_organ,
					};
					cnt_records++;
				}
				else {
					let rec = database.blocked_domain[domain];
					if (rec.blocked) {
						if (blocked_date < rec.date) rec.date = blocked_date;
					}
					else {
						//console.warn('Blocked domain & URLs:',domain,real_domain);
						rec.date = blocked_date;
						rec.blocked = true;
						rec.postanovlenie = postanovlenie;
						rec.gos_organ = gos_organ;
					}
				}
			}
			else if (data[0]) { //array of ip
				let arr_ip = data[0].split(" | ");
				let cnt_ip = arr_ip.length;
				cnt_records += cnt_ip;
				for (let i=0; i<cnt_ip; i++) {
					let ip = arr_ip[i];
					if (ip.indexOf('/') > -1) database.blocked_ip_range.push(ip);
					else database.blocked_ip[ip] = true;
					//if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip) && !/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(ip)) console.warn('Bad ip:',ip);
				}
			}
		}
		localStorage['Antizapret_updateTime'] = base_date;
		//end of csv parse
	}
	else { //short csv format
		let row = csv.split("\n");
		let cnt = row.length;
		if (cnt < 1000) { //Error in database! 
			return 'Error in database!';
		}
		//check db format
		let cnt_good = 0;
		for (let i=0;i<1000;i++) {
			if (row[i].split(';').length >= 4) cnt_good++;
		}
		if (cnt_good < 950) { //Error in database! Wrong format;
			//Probably 404 or 500 or something like that.
			return 'Error in database! Wrong format';
		}
		reset_Database();
		for (let i=0; i<cnt; i++) {
			let data = row[i].split(';');
			if (data.length != 4) {
				if (data.length > 4) { //fix a known bug in the csv file: symbols ";" in url.
					let restore_url = data.splice(1, data.length - 3).join(';');
					data.splice(1, 0, restore_url);
					//console.warn("Error ';' in URL:",restore_url);
				}
				else { //unknown bug
					if (data[0]) console.warn('Error: ',row[i]);
					continue;
				}
			}
			//format: [0] - date; [1] - array of urls; [2] - domain; [3] - array of ip
			let blocked_date = data[0];
			let urls = data[1];
			let domain = extractHostname(data[2]);
			if ((urls || domain) && data[3]) {
				let arr_ip = data[3].split(",");
				let cnt_ip = arr_ip.length;
				for (let i=0; i<cnt_ip; i++) {
					if (arr_ip[i].indexOf('/') > -1) console.warn("Error in minor ip, it should not be range:",arr_ip[i]);
					else database.blocked_site_ip[arr_ip[i]] = true;
				}
			}
			if (urls) { //url
				let arr_url = urls.split(",http"); //and https
				if (arr_url.length > 1) for(let j=1; j<arr_url.length; j++) {
					arr_url[j] = "http" + arr_url[j];
					//if (arr_url[j].indexOf(',') > -1) console.warn("Error ',' in URL:",arr_url[j]);
				}
				cnt_records += arr_url.length;
				for (let i=0; i<arr_url.length; i++) {
					let url = arr_url[i];
					if (!domain) { //cover possible csv error
						domain = extractHostname(url).toLowerCase(); 
						//console.warn('Error no domain:',row[i]);
					}
					
					if (domain != extractHostname(url).toLowerCase()) { //cover known csv bug
						let url_domain = extractHostname(url).toLowerCase();
						//console.warn('Error in domain:', domain, url_domain);
						if (!database.blocked_domain[domain]) { //Add a record for this domain. It's possibly blocked.
							database.blocked_domain[domain] = {
								blocked: false,
								date: blocked_date,
								urls: [],
							};
						}
						domain = url_domain;
					}
					
					if (!database.blocked_domain[domain]) {
						database.blocked_domain[domain] = {
							blocked: false,
							date: blocked_date,
							urls: [],
						};
					}
					let rec = database.blocked_domain[domain];
					
					if (url.substr(0,7) == 'http://') url = url.substr(7, url.length-7);
					else if (url.substr(0,8) == 'https://') url = url.substr(8, url.length-8);
					else {
						//console.warn('Bad url:',url);
						continue;
					}
					
					
					
					if ((!rec.blocked) && blocked_date < rec.date) rec.date = blocked_date;
					if (database.blocked_url[url]) {
						if (blocked_date < database.blocked_url[url]) database.blocked_url[url] = blocked_date;
					}
					else {
						database.blocked_url[url] = blocked_date;
						rec.urls.push(url);
					}
				}
			}
			else if (domain) { //URL doesn't exist but domain exists. Type of block: by domain.
				if (domain[0] == "*") { //*.example.com
					database.blocked_mask[domain.substr(2,domain.length-2)] = blocked_date;
					cnt_records++;
				}
				else if (!database.blocked_domain[domain]) {
					database.blocked_domain[domain] = {
						blocked: true,
						date: blocked_date,
						urls: [],
					};
					cnt_records++;
				}
				else {
					let rec = database.blocked_domain[domain];
					if (rec.blocked) {
						if (blocked_date < rec.date) rec.date = blocked_date;
					}
					else {
						//console.warn('Blocked domain & URLs:',domain,real_domain);
						rec.date = blocked_date;
						rec.blocked = true;
					}
				}
			}
			else if (data[3]) { //array of ip
				let arr_ip = data[3].split(",");
				let cnt_ip = arr_ip.length;
				cnt_records += cnt_ip;
				for (let i=0; i<cnt_ip; i++) {
					let ip = arr_ip[i];
					if (ip.indexOf('/') > -1) database.blocked_ip_range.push(ip);
					else database.blocked_ip[ip] = true;
					//if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip) && !/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(ip)) console.warn('Bad ip:',ip);
				}
			}
		}
		//end of csv parse
	}
	/* for (var prop in database.blocked_domain) {
		let rec = database.blocked_domain[prop];
		if (!rec.blocked) console.log(prop,rec.urls.length);
	} */
	if (no_save) { //DB is loaded from disk.
		if (localStorage['db_updated_date']) { //time of last update
			db_updated_date = localStorage['db_updated_date']
		}
		else { //impossible
			console.warn('Impossible error! Time of DB is unknown!');
			db_updated_date = (new Date()).getTime();
			localStorage['db_updated_date'] = db_updated_date;
		}
	}
	else db_updated_date = (new Date()).getTime(); //Save clock
	//setTimer(1000); //need not
	options_hint.is_updating = false;
	options_hint.update_records = cnt_records;
	options_hint.update_error = '';
	options_hint.updated_date = db_updated_date;
	options_hint.db_size = (csv.length / (1024*1024)).toFixed(0) + ' Мб';
	//options_hint.loaded_csv_time = db_updated_date - start_updating_tm;
	//console.log('Loaded CSV:',options_hint.loaded_csv_time/1000);
	options_update();
	//setTimer(1000);
	
	
	//Update current URL (Warning: there is a little bug, it will consider DevTools tab if active and selected.
	InitializeIconHandlers();
	updateIcon();
	
	//Save database
	//localStorage['db'] = csv; //doesn't work because of limit 5 Mb
	if (db && !no_save) {
		db.transaction("csv","readwrite").objectStore("csv").put(csv,1).onsuccess = function(e) {
			localStorage['db_updated_date'] = db_updated_date;
			console.log("DB saved"); //,e);
		}
	}
	return true;
}

let onUpdateError = function(xhr, readyState, status) {
	//onerror
	//console.log(readyState,status,xhr.readyState,xhr.status,xhr);
	if (readyState == 1) return;
	if (readyState == 0) { //impossible
		console.warn("request not initialized!");
		return setTimer(30000);
	}
	if (readyState == 4) {
		//EXIT
		setTimer(10000)
		options_hint.is_updating = false;
		options_hint.update_error = '<font color=red>Ошибка обновления: '+status+'</font><br>Ответ сервера:<br><textarea cols=30 rows=4>'
			+xhr.responseText+'</textarea>';
		options_update();
		updateIcon();
		return; //Error! Try again NOW!
	}
	if (status == 200) return setTimer(150000); //+2 minutes. Still loading...
}

function fail_load(result) {
	options_hint.is_updating = false;
	options_hint.update_error = result;
	options_update();
	updateIcon();
	setTimer(300000); //???
}

function load_Database_Antizapret() { // https://antizapret.info/api.php
	//check date
	let checkUpdateDate = function(data) {
		if (data.updateTime == localStorage['Antizapret_updateTime']) {
			//no fresh data. EXIT
			db_updated_date = (new Date()).getTime();
			localStorage['db_updated_date'] = db_updated_date;
			setTimer(UPDATE_TIME); //30 minutes
			options_hint.is_updating = false;
			options_hint.update_error = 'Нет свежих обновлений.';
			options_hint.updated_date = db_updated_date;
			options_update();
			updateIcon();
		} else {
			//fresh data exists. Let's load...
			if (localStorage['db_source'] == 1) { //JSON
				load_String_From_URL("http://api.antizapret.info/all.php?type=json", update_Database, onUpdateError, function(){
					localStorage['Antizapret_updateTime'] = data.updateTime;
					setTimer(UPDATE_TIME); //30 minutes
				});
			}
			else { //CSV
				load_String_From_URL("http://api.antizapret.info/all.php", update_Database, onUpdateError, function(){
					localStorage['Antizapret_updateTime'] = data.updateTime;
					setTimer(UPDATE_TIME); //30 minutes
				});
			}
		}
	}
	load_String_From_URL('https://api.antizapret.info/get.php?item=just-want-to-check-db-date&type=json', function(txt) {
		let data = JSON_parse(txt);
		if (!data.updateTime) { //What?? Don't like this item? Let't try again...
			let makeid = function() {
				let text = "";
				let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
				let len = Math.floor(Math.random() * 7) + 9; //9..15
				let dot = Math.floor(Math.random() * 5) + 2; //2..6
				for (let i = 0; i < len; i++) {
					if (i == dot) text += '.';
					else text += possible.charAt(Math.floor(Math.random() * possible.length));
				}
				return text;
			}
			load_String_From_URL('https://api.antizapret.info/get.php?item='+makeid()+'.com&type=json', function(txt) {
				let data = JSON_parse(txt);
				if (!data.updateTime) { //EXIT
					console.warn('Antizapret.info is down!',txt);
					options_hint.is_updating = false;
					options_hint.update_error = 'Ошибка обновления: неправильный формат!<br>Ответ сервера:<br><textarea cols=30 rows=4>'
						+txt+'</textarea>';
					options_update();
					updateIcon();
					return setTimer(300000); //5 minutes;
				}
				else checkUpdateDate(data);
			},onUpdateError);
		}
		else checkUpdateDate(data);
	},onUpdateError);
}



function load_Database_Rublacklist() { // https://reestr.rublacklist.net/article/api
	let on_success = function() {
		//localStorage['Antizapret_updateTime'] = data.updateTime; //jj
		setTimer(UPDATE_TIME); //6*30 minutes
	}
	let on_fail = function () {
		setTimer(300000);
		//spare url
		load_String_From_URL('https://api.reserve-rbl.ru/api/v2/current/json', update_Database, onUpdateError, on_success, fail_load);
	}
	load_String_From_URL('https://reestr.rublacklist.net/api/v2/current/json', update_Database, onUpdateError, on_success, on_fail);
}

function load_Database_Github() { // https://raw.githubusercontent.com/zapret-info/z-i/master/dump.csv
	let on_success = function() {
		setTimer(UPDATE_TIME); //6*30 minutes
	}
	load_String_From_URL('https://raw.githubusercontent.com/zapret-info/z-i/master/dump.csv',
		update_Database, onUpdateError, on_success, fail_load, "windows-1251");
}


function change_frequency(hours) {
	localStorage.update_frequency = hours;
	UPDATE_TIME = hours * 60 * 60 * 1000;
	setTimer(0);
}
if (!localStorage.update_frequency) localStorage.update_frequency = 6; //hours
let UPDATE_TIME = localStorage.update_frequency * 60 * 60 * 1000; //30 minutes
let save_upd_timer = -1;
function setTimer(timeout) { //Renew (replace) update timer.
	clearTimeout(save_upd_timer);
	if (timeout > 150000) console.log("New timout:",timeout/1000);
	save_upd_timer = setTimeout(check_For_Updates,timeout);
}

if (localStorage['db_source'] === undefined) localStorage['db_source'] = 3; //load from github.com
if (localStorage.show_updating === undefined) localStorage.show_updating = 1;
if (localStorage.use_httpdns === undefined) localStorage.use_httpdns = 1;
if (localStorage.check_site_is_online === undefined) localStorage.check_site_is_online = 0;
if (localStorage.custom_provider_stub === undefined) localStorage.custom_provider_stub = 'warning.rt.ru';
function check_For_Updates() {
	if (xhttp) xhttp.abort(); //enough! try again...
	options_hint.is_updating = false; options_update();
	if (!window.navigator.onLine) return setTimer(30000); //pause until connected.
	let now = (new Date()).getTime();
	let need_update = !(Math.abs(now - db_updated_date) < UPDATE_TIME ); // NaN < 60 === false
	if (need_update || !database) {
		console.log("Need update");
		if (localStorage['db_source'] == -1) { //stop update
			setTimer(100 * 60*60*1000);
			return;
		}
		options_hint.is_updating = true;
		options_hint.update_error = '';
		options_update();
		updateIcon();
		if (localStorage['db_source'] == 2) load_Database_Rublacklist();
		else if (localStorage['db_source'] == 3) load_Database_Github();
		else load_Database_Antizapret(); //1 and 0 and undefined
		setTimer(150000);
	}
	else {
		console.log("Not need update");
		let timeout = (UPDATE_TIME - Math.abs(now - db_updated_date) + 5000);
		setTimer(timeout);
	}
}
setTimer(7000);

//Immediately update database.
let update_now_button_clicked_tm = 0;
function update_now() {
	localStorage['Antizapret_updateTime'] = 0;
	let now = (new Date()).getTime();
	let need_extra_update = !(Math.abs(now - db_updated_date) < 30000 ) //1 minute!
		&& !(Math.abs(now - update_now_button_clicked_tm) < 30000 )
	if (need_extra_update) { 
		db_updated_date = 0;
		update_now_button_clicked_tm = now;
		setTimer(0);
	}
	else {
		options_hint.update_error = 'Подождите минуту, потом ещё раз обновляйтесь.';
		options_update();
		//console.log("Wait!");
	}
}

//--------------- INITIALIZE LOCAL WHITELIST ----------------

let whitelist = {
	domain: {},
	domain_mask: {},
	ip: {},
	ip_range: [],
};
(function() {
	let xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			let row = xhr.responseText.split('\n');
			for(let i=0;i<row.length;i++) {
				let data=row[i].split('\t');
				let domain = extractHostname(data[0]);
				let ip = data[1];
				if (domain[0] == '*') whitelist.domain_mask[domain.substr(2,domain.length-2)] = true;
				else whitelist.domain[domain] = true;
				if (ip) {
					if (ip.indexOf('/') > -1) whitelist.ip_range.push(ip);
					else whitelist.ip[ip] = true;
				}
			}
			console.log('Loaded whitelist.');
		}
	};
	xhr.open("GET", 'whitelist-rkn.txt', true);
	xhr.send();
})();

//----------------- GET IP OF EACH TAB --------------

const ip4ToInt = ip =>
  ip.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;

const isIp4InCidr = ip => cidr => {
	const [range, bits = 32] = cidr.split('/');
	const mask = ~(2 ** (32 - bits) - 1);
	if ((ip4ToInt(ip) & mask) === (ip4ToInt(range) & mask)) {
		blocked_ip_reason = database.blocked_ip_reason[cidr];
		if (blocked_ip_reason) blocked_ip_reason.mask = cidr;
		return true;  
	}
	return false;
};

const isIp4InCidrs = (ip, cidrs) => cidrs.some(isIp4InCidr(ip));
// console.log(isIp4InCidrs('192.168.1.5', ['10.10.0.0/16', '192.168.1.1/24'])) //true

//Search ip in database. 2 = blocked. 1 = should be blocked. 0 = not blocked.
let blocked_ip_reason;
function check_ip(ip) {
	blocked_ip_reason = undefined;
	if (ip.indexOf(":") > -1) return 0; //ipv6. Not supported yet.
	if (database.blocked_ip[ip]) {
		blocked_ip_reason = database.blocked_ip_reason[ip];
		return 2;
	}
	if (isIp4InCidrs(ip, database.blocked_ip_range)) return 2; //ip range
	if (database.blocked_site_ip[ip]) return 1;
	return 0;
}


let save_info_ip = {}; //local ip cache

let webRequestAnalyzeIP = function(d) {
	if (!(d.tabId && d.url && d.tabId>0)) return;
	if (d.url.substr(0,4) != 'http') return;
	extractHostname(d.url);
	if (!save_info_ip[real_domain]) save_info_ip[real_domain] = {ip:{},tab_ip:{},reason:{}};
	let rec = save_info_ip[real_domain];
	if (d.ip) {
		rec.ip[d.ip] = check_ip(d.ip);
		rec.tab_ip[d.tabId] = d.ip;
		rec.reason[d.ip] = blocked_ip_reason;
		rec.is_error = false;
		//console.log("onCompleted",real_domain,d);
	} else { //error?
		rec.tab_ip[d.tabId] = undefined;
		rec.is_error = true;
	}
	chrome.tabs.get(d.tabId, function(tab) {
		if (!tab) {
			let e = chrome.runtime.lastError;
			return;
		}
		if (tab.active) updateIcon(d.url, tab.id);
		//if (tab.url != d.url) console.warn("Error! URL mismatch!",tab.url,d.url);
	});
}

let webRequestFilter = {'urls' : ["<all_urls>"], 'types' : ['main_frame']};
chrome.webRequest.onCompleted.addListener(webRequestAnalyzeIP, webRequestFilter);
chrome.webRequest.onErrorOccurred.addListener(webRequestAnalyzeIP, webRequestFilter);
chrome.webRequest.onBeforeRedirect.addListener(webRequestAnalyzeIP, webRequestFilter);
chrome.webRequest.onResponseStarted.addListener(webRequestAnalyzeIP, webRequestFilter);

//----------------DEBUG-----------------------

function gens(size) {
	let ch = "";
	for (i=0;i<10;i++) ch+="1234567890";
	let done = 0;
	let arr = [];
	while (done < size) {
		arr.push(ch);
		done+=100;
	}
	return arr.join("");
}

function delete_db() {
	return db.transaction("csv","readwrite").objectStore("csv").delete(1);
}

function delete_db_full() {
	return db.deleteObjectStore("csv");
}


//----------------------- PUNY CODE ------------------------

TMIN = 1;
TMAX = 26;
BASE = 36;
SKEW = 38;
DAMP = 700; // initial bias scaler
INITIAL_N = 128;
INITIAL_BIAS = 72;

function adapt_bias(delta, n_points, is_first) {
  // scale back, then increase delta
  delta /= is_first ? DAMP : 2;
  delta += ~~(delta / n_points);

  var s = (BASE - TMIN)
  var t = ~~((s * TMAX) / 2) // threshold=455

  for (var k = 0; delta > t; k += BASE) {
    delta = ~~(delta / s);
  }

  var a = (BASE - TMIN + 1) * delta
  var b = (delta + SKEW)

  return k + ~~(a / b)
}

function next_smallest_codepoint(codepoints, n) {
  var m = 0x110000; // unicode upper bound + 1

  for (var i = 0, len = codepoints.length; i < len; ++i) {
    var c = codepoints[i];
    if (c >= n && c < m) {
      m = c;
    }
  }

  // sanity check - should not happen
  if (m >= 0x110000) {
    throw new Error('Next smallest code point not found.');
  }

  return m;
}

function encode_digit(d) {
  return d + (d < 26 ? 97 : 22);
}

function decode_digit(d) {
  if (d >= 48 && d <= 57) {
    return d - 22 // 0..9
  }
  if (d >= 65 && d <= 90) {
    return d - 65 // A..Z
  }
  if (d >= 97 && d <= 122) {
    return d - 97 // a..z
  }
  throw new Error('Illegal digit #' + d)
}

function threshold(k, bias) {
  if (k <= bias + TMIN) {
    return TMIN;
  }
  if (k >= bias + TMAX) {
    return TMAX;
  }
  return k - bias;
}

function encode_int(bias, delta) {
  var result = [];

  for (var k = BASE, q = delta; ; k += BASE) {
    var t = threshold(k, bias);
    if (q < t) {
      result.push(encode_digit(q));
      break;
    }
    else {
      result.push(encode_digit(t + ((q - t) % (BASE - t))));
      q = ~~((q - t) / (BASE - t));
    }
  }

  return result;
}

function puny_encode(input) {
  if (typeof input != 'string') {
    throw new Error('Argument must be a string.');
  }

  input = input.split('').map(function(c) {
    return c.charCodeAt(0);
  });

  var output = [];
  var non_basic = [];

  for (var i = 0, len = input.length; i < len; ++i) {
    var c = input[i];
    if (c < 128) {
      output.push(c);
    }
    else {
      non_basic.push(c);
    }
  }

  var b, h;
  b = h = output.length;

  if (b) {
    output.push(45); // delimiter '-'
  }

  var n = INITIAL_N;
  var bias = INITIAL_BIAS;
  var delta = 0;

  for (var len = input.length; h < len; ++n, ++delta) {
    var m = next_smallest_codepoint(non_basic, n);
    delta += (m - n) * (h + 1);
    n = m;

    for (var i = 0; i < len; ++i) {
      var c = input[i];
      if (c < n) {
        if (++delta == 0) {
          throw new Error('Delta overflow.');
        }
      }
      else if (c == n) {
        // TODO append in-place? i.e. -> output.push.apply(output, encode_int(bias, delta));
        output = output.concat(encode_int(bias, delta));
        bias = adapt_bias(delta, h + 1, b == h);
        delta = 0;
        h++;
      }
    }
  }

  return String.fromCharCode.apply(String, output);
}

function puny_decode(input) {
  if (typeof input != 'string') {
    throw new Error('Argument must be a string.');
  }

  // find basic code points/delta separator
  var b = 1 + input.lastIndexOf('-');

  input = input.split('').map(function(c) {
    return c.charCodeAt(0);
  });

  // start with a copy of the basic code points
  var output = input.slice(0, b ? (b - 1) : 0);

  var n = INITIAL_N;
  var bias = INITIAL_BIAS;

  for (var i = 0, len = input.length; b < len; ++i) {
    var org_i = i;

    for (var k = BASE, w = 1; ; k += BASE) {
      var d = decode_digit(input[b++]);

      // TODO overflow check
      i += d * w;

      var t = threshold(k, bias);
      if (d < t) {
        break;
      }

      // TODO overflow check
      w *= BASE - t;
    }

    var x = 1 + output.length;
    bias = adapt_bias(i - org_i, x, org_i == 0);
    // TODO overflow check
    n += ~~(i / x);
    i %= x;

    output.splice(i, 0, n);
  }

  return String.fromCharCode.apply(String, output);
}

function decode_domain(domain) {
	let arr_name = domain.split('.');
	for (let i=0;i<arr_name.length;i++) {
		try {
			if (arr_name[i].substr(0,4) == 'xn--') arr_name[i] = puny_decode(arr_name[i].substr(4,arr_name[i].length-4));
		} catch(e) {
			//nobody cares
		}
	}
	return arr_name.join('.');
}





