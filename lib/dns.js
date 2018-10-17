
//-------------------------DNS--------------------------

if (localStorage.httpdns === undefined) localStorage.httpdns = Math.random() < 0.5 ? 3 : 0; // cloudflare or google. 50/50

let dns_cache = {}
function isDnsCached(domain) {
	if(!domain)return;
	const now = (new Date()).getTime();
	const rec = dns_cache[domain];
	if (rec && (now - rec.time < 360000*2)) return true; //2 hours
}
function getDnsCached(domain) {
	if(!domain)return;
	return dns_cache[domain];
}
function clearDNSCache() {
	dns_cache = {};
}
function getDNS(domain,callback) {
	//if (!callback) callback=updateIcon;
	//console.log('getDNS',domain);
	if(!domain)return;
	let rec = dns_cache[domain];
	let now = (new Date()).getTime();
	let xhr = new XMLHttpRequest();
	if (localStorage.httpdns == 3 || localStorage.httpdns == 0) { //https://developers.cloudflare.com/1.1.1.1/dns-over-https/request-structure/
		xhr.onreadystatechange = function() {
			if (this.readyState == 4 && this.status != 200)
				console.log("getDNS ERROR (cloudflare/google)",this.status,xhr.responseText);
			if (this.readyState == 4 && this.status == 200) {
				try {
					const o = JSON.parse(xhr.responseText);
					const arr = o.Answer;
					if (o.Status != 0 || arr.length === undefined) return console.log('cloudflare/google dns error:',xhr.responseText);
					if (!rec) {
						rec={};
						dns_cache[domain]=rec;
					}
					rec.ip = {};
					rec.reason = {};
					rec.time = now;
					//if (!arr.length) return; //keep empty record in cache. Don't update it until timeout.
					for(let i=0;i<arr.length;i++) {
						let ip = arr[i].data;
						if (arr[i].type == 1) {
							rec.ip[ip] = check_ip(ip);
							if (rec.ip[ip] == 2) rec.reason[ip] = blocked_ip_reason;
						}
					}
					callback(rec);
				} catch(e) {
					//console.log(e,xhr.responseText);
				}
			}
		};
		if (localStorage.httpdns == 3) xhr.open("GET", 'https://cloudflare-dns.com/dns-query?name='+domain+'&type=A&ct=application/dns-json', true);
		else xhr.open("GET", 'https://dns.google.com/resolve?name='+domain+'&type=A', true);
	} else if (localStorage.httpdns == 2) { //dns-api.org
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
					rec.reason = {};
					rec.time = now;
					//if (!arr.length) return; //keep empty record in cache. Don't update it until timeout.
					for(let i=0;i<arr.length;i++) {
						let ip = arr[i].value;
						if (ip && arr[i].type == "A") {
							rec.ip[ip] = check_ip(ip);
							if (rec.ip[ip] == 2) rec.reason[ip] = blocked_ip_reason;
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
					rec.reason = {};
					rec.time = now;
					//if (!arr.length) return; //keep empty record in cache. Don't update it until timeout.
					for(let i=0;i<arr.length;i++) {
						let ip = arr[i];
						rec.ip[ip] = check_ip(ip);
						if (rec.ip[ip] == 2) rec.reason[ip] = blocked_ip_reason;
					}
					callback(rec);
				} catch(e) {
				}
			}
		};
		xhr.open("GET", 'http://dns.bermap.ru/?key=2F3468E768AE36F5345C375EF172F21FA2C6390&host='+domain+'&type=A', true);
	}
	else return console.log('Unknown dns!');
	xhr.send();
	//console.log('send');
}
