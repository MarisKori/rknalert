
//----------------- GET IP OF EACH TAB --------------

const ip4ToInt = ip =>
  ip.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;

const isIp4InCidr = ip => cidr => {
	const [range, bits = 32] = cidr.split('/');
	const mask = ~(2 ** (32 - bits) - 1);
	if ((ip4ToInt(ip) & mask) === (ip4ToInt(range) & mask)) {
		blocked_ip_reason = database.blocked_ip_reason[cidr];
		//console.log(cidr);
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
		let e = chrome.runtime.lastError;
		if (!tab) {
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
