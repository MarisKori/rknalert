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


//---------------------- PROXY -------------------

var known_proxy_name = ['','Прокси от ValdikSS','RuTracker Proxy','anonymoX Proxy'];
//proxy ips
var known_proxy_ip = {
	//proxy.antizapret.prostovpn.org
	"195.123.214.52":1, "195.123.214.53":1, "195.123.214.54":1, "54.37.137.152":1,
	"54.37.137.153":1, "137.74.171.91":1, "163.172.173.40":1, "185.14.31.172":1,
	//ccahiha.antizapret.prostovpn.org
	"195.123.225.47":1, "195.123.217.178":1, "195.123.225.31":1,
	//rutracker
	'195.82.146.20':2, '163.172.167.207':2, '195.82.146.100':2,
}
//const known_proxy = {
	//Browsec VPN
	//'at1.lunrac.com':4, 'at2.lunrac.com':4, 
//}
function check_proxy_ip() {
	getDNS('proxy.antizapret.prostovpn.org',function(rec){
		//dont remove old ips
		for(let ip in rec.ip) known_proxy_ip[ip] = 1;
	})
	getDNS('ccahiha.antizapret.prostovpn.org',function(rec){
		//dont remove old ips
		for(let ip in rec.ip) known_proxy_ip[ip] = 1;
	})
}
setInterval(check_proxy_ip, 24 * 60 * 60 * 1000);
check_proxy_ip();





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
	//xhttp.setRequestHeader('Content-Type', 'application/dns-json');
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
						date: blocked_date,
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
					database.blocked_ip_reason[ip] = {
						postanovlenie: postanovlenie,
						gos_organ: gos_organ,
						date: blocked_date,
					}
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

//------------------------ CHECK WHOIS ---------------------------

if (localStorage.show_age === undefined) localStorage.show_age = 1;

const whois_cache = {}

function getWhoisCached(domain) {
	//console.log('whois cache',domain);
	const root = extractRootDomain(domain);
	if (whois_cache[root]) return {domain:domain, result:whois_cache[root].result};
}

function getWhois(domain, callback) {
	//console.log('whois',domain);
	const root = extractRootDomain(domain);
	let xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (this.readyState == 4) {
			//console.log('success');
			if (this.status != 200) return console.log('error',this.status);
			let start = xhr.responseText.indexOf('<p><b>Возраст домена:');
			if (start == -1) return //console.log('error1');
			let end = xhr.responseText.indexOf('</b></p>', start);
			if (end == -1) return //console.log('error2');
			let result = xhr.responseText.substr(start + 22, end - start - 22);
			if (!/>\d+ .*<\/span/.test(result)) return //console.log('error3',result);
			whois_cache[root] = {
				time: 0, //(new Date()).getTime(),
				result: result,
			}
			try {
				callback({domain:domain, result:result});
			} catch(e) {
				//window dead (firefox)
			}
		}
	};
	xhr.open("GET", 'https://xn--b1aaefabsd1cwaon.xn--p1ai/site/'+root, true); // довериевсети.рф
	xhr.send();
}







