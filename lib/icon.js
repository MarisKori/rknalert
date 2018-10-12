
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
	chrome.browserAction.setTitle({title:"RKN Alert",tabId:tabId});
	chrome.browserAction.setBadgeText({text:""});
	//console.log("url:",url);
	if (!url) {
		chrome.browserAction.setIcon({path: "images/circ_gray_gray_16.png"});
		return popup_update();
	}
	if (url.substr(0,4) != "http" && url.indexOf('//') > -1) { // && url.substr(0,5) != "https"
		chrome.browserAction.setIcon({path: "images/circ_gray_gray_16.png"});
		//console.log(icon_hint);
		return popup_update();
	}
	if (tabId && !is_bad_url) saved_last_url[tabId] = url;
	
	let domain = extractHostname(url);
	
	if (arr_special_url[domain]) { // about:addons in FireFox
		chrome.browserAction.setIcon({path: "images/circ_gray_gray_16.png"});
		return popup_update();
	}
	
	if (domain=='localhost') icon_hint.is_whitelist_ip_local = true;

	if (options_hint.urls || options_hint.domain) {
		options_hint.urls = undefined;
		options_hint.domain = undefined;
		options_update();
	}
	
	if (permanently_blocked[domain]) icon_hint.permanently_blocked = true;
	
	icon_hint.hostname = decode_domain(real_domain);
	icon_hint.real_domain = real_domain;
	icon_hint.ip_arr = {};
	let ip, info = save_info_ip[real_domain];
	let is_ip_blocked = 0;
	//console.log("info",tabId,info);
	if (info && tabId) {
		if (info.is_error) icon_hint.is_error = true;
		ip = info.tab_ip[tabId];
		if(ip) icon_hint.reason_ip = info.reason[ip];
		if (info.ip[ip] == 2) is_ip_blocked = 2;
		for(let ip in info.ip) icon_hint.ip_arr[ip] = info.ip[ip]; //copy object
	}
	else if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
		ip = domain;
		console.log('Error ip not updated:',ip,info);
		icon_hint.ip_arr[ip] = check_ip(ip);
		if (icon_hint.ip_arr[ip] == 2) is_ip_blocked = 2;
		icon_hint.reason_ip = blocked_ip_reason;
		//if(info) for(let ip in info.ip) icon_hint.ip_arr[ip] = info.ip[ip]; //copy object. Never happens
	}
	//if (!ip && extracted_blocked_ip) ip = extracted_blocked_ip; //info from provider!..
	if (ip) {
		icon_hint.ip = ip;
		//ip in whitelist?
		if (whitelist.ip[ip] || isIp4InCidrs(ip,whitelist.ip_range)) icon_hint.is_whitelist_ip = true;
		if (isIp4InCidrs(ip,whitelist_ip_local_arr)) icon_hint.is_whitelist_ip_local = true;
	}
	if (icon_hint.reason_ip && icon_hint.reason_ip.mask) {
		icon_hint.ip_arr[icon_hint.reason_ip.mask] = 2;
		is_ip_blocked = 3;
	}
	//check dns
	let dns = getDnsCached(real_domain);
	if (dns) {
		for(let ip in dns.ip) {
			if (!icon_hint.ip_arr[ip]) { //undefined || 0
				icon_hint.ip_arr[ip] = dns.ip[ip] == 0 ? 5 : dns.ip[ip];
				if (dns.ip[ip] > is_ip_blocked) is_ip_blocked = dns.ip[ip];
			}
			if (dns.reason[ip]) {
				if (dns.reason[ip].mask) {
					icon_hint.ip_arr[dns.reason[ip].mask] = 2;
					is_ip_blocked = 3;
				}
				if (!icon_hint.reason_ip) {
					icon_hint.reason_ip = dns.reason[ip];
				}
			}
		}
	}
	
	icon_hint.is_ip_blocked = is_ip_blocked;
	if (localStorage.check_site_is_online == 1) {
		if (icon_hint.is_error || localStorage.check_site_only_if_error != 1) {
			icon_hint.check_is_online = true;
		}
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
			chrome.browserAction.setTitle({title:"*." + test_domain,tabId:tabId});
			icon_hint.reason = database.blocked_mask_reason[test_domain];
			return popup_update();
		}
		let is_whitelist = icon_hint.is_whitelist_domain || icon_hint.is_whitelist_ip || icon_hint.is_whitelist_ip_local;
		//Check blocked ip
		if (ip && icon_hint.ip_arr[ip] > 0 && icon_hint.ip_arr[ip] != 5) {
			let status = icon_hint.ip_arr[ip];
			if (status == 2) {
				if (icon_hint.reason_ip) icon_hint.date = icon_hint.reason_ip.date;
				if (is_ip_blocked === 3) icon_hint.text = "Заблокирована целая подсеть.";
				else icon_hint.text = "Сайт заблокирован по ip";
				chrome.browserAction.setTitle({title:"ip " + ip,tabId:tabId});
				chrome.browserAction.setIcon({path: "images/circ_yellow_red_16.png"});
			}
			else if (status == 1) {
				if (!icon_hint.is_whitelist_ip_local) icon_hint.text = "Некоторые провайдеры блокируют этот сайт по ip";
				if (is_whitelist)
					//in whitelist (ignore status 1):
					chrome.browserAction.setIcon({path: "images/circ_whitelist_16.png"});
				else
					chrome.browserAction.setTitle({title:"Не должно быть блокировки",tabId:tabId});
					chrome.browserAction.setIcon({path: "images/circ_green_yellow_16.png"});
			}
			else chrome.browserAction.setIcon({path: "images/circ_unknown_16.png"});
			return popup_update();
		}
		//Check block of the site by ip
		if (!ip && is_ip_blocked) {
			if (is_ip_blocked === 3) {
				if (icon_hint.reason_ip) icon_hint.date = icon_hint.reason_ip.date;
				icon_hint.text = "Заблокирована целая подсеть.";
				chrome.browserAction.setTitle({title:"Ковровая блокировка",tabId:tabId});
				chrome.browserAction.setIcon({path: "images/circ_yellow_red_16.png"});
			} else if (is_ip_blocked === 2) {
				if (icon_hint.reason_ip) icon_hint.date = icon_hint.reason_ip.date;
				icon_hint.text = "Блокировка по ip";
				chrome.browserAction.setTitle({title:"Блокировка по ip",tabId:tabId});
				chrome.browserAction.setIcon({path: "images/circ_yellow_red_16.png"});
			} else if (is_ip_blocked === 1) {
				if (!icon_hint.is_whitelist_ip_local) icon_hint.text = "Некоторые провайдеры блокируют этот сайт по ip";
				if (is_whitelist)
					chrome.browserAction.setIcon({path: "images/circ_whitelist_16.png"});
				else
					chrome.browserAction.setIcon({path: "images/circ_green_yellow_16.png"});
			}
			else chrome.browserAction.setIcon({path: "images/circ_unknown_16.png"});
			return popup_update();
		}
		//No block
		if (is_whitelist) { //in whitelist:
			chrome.browserAction.setIcon({path: "images/circ_whitelist_16.png"});
		} else { //Green icon:
			chrome.browserAction.setIcon({path: "images/circ_green_green_16.png"});
		}
		return popup_update();
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
		chrome.browserAction.setTitle({title:"Ссылка заблокирована",tabId:tabId});
		if (rec.blocked) {
			icon_hint.domain_blocked = true;
			chrome.browserAction.setIcon({path: "images/circ_red_red_16.png"});
			icon_hint.text = "URL и домен заблокированы.";
		}
		else {
			chrome.browserAction.setIcon({path: "images/circ_red_white_16.png"});
			icon_hint.text = "URL заблокирован, но домен разрешён.";
		}
		return popup_update();
	}
	if (rec.blocked) {
		icon_hint.domain_blocked = true;
		if (!icon_hint.date) icon_hint.date = rec.date;
		if (rec.postanovlenie && !icon_hint.reason) icon_hint.reason = {
			postanovlenie: rec.postanovlenie,
			gos_organ: rec.gos_organ,
		};
		chrome.browserAction.setIcon({path: "images/circ_pink_red_16.png"});
		chrome.browserAction.setTitle({title:"Домен заблокирован",tabId:tabId});
		return popup_update();
	}
	//not blocked, but there are blocked URLs
	chrome.browserAction.setIcon({path: "images/circ_orange_green_16.png"});
	icon_hint.text = "На сайте есть заблокированные URL.";
	popup_update();
}

function onPopupOpen(popup) {
	//dns
	if (localStorage.use_httpdns == 1
		&& icon_hint.real_domain
		&& icon_hint.real_domain != icon_hint.ip
		&& !isDnsCached(icon_hint.real_domain))
	{ 
		getDNS(icon_hint.real_domain, (rec) => {
			updateIcon();
		});
	}
	//accessibility
	if (icon_hint.check_is_online) {
		check_if_is_online(icon_hint.real_domain, popup.update_site_status);
	}
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
