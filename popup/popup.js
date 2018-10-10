let background = chrome.extension.getBackgroundPage();

let html;
function add(info) {
	html += info + "<br>\n";
}

let save_ip; //={}
function show_ip_list() {
	let cnt=0;
	for(let ip in save_ip.ip) {
		cnt++;
		if (cnt>1)break;
	}
	let hint = background.icon_hint;
	let html = '';
	let is_proxy;
	for(let ip in save_ip.ip) {
		let line = ip;
		let status = save_ip.ip[ip];
		if (status == 1) line = '<font color="#ff8e00">'+line+'</font>';
		else if (status == 2) line = '<font color="#ff0000">'+line+'</font>';
		else if (status == 5) line = '<font color="#00bb00">'+line+'</font>';
		if (background.known_proxy_ip[ip]) { //proxy may be blocked
			line = '<font color="#0000ff">('+line+')</font>';
			if (ip == hint.ip) is_proxy = background.known_proxy_ip[ip];
		}
		line = '<b>'+line+'</b>';
		if (ip == hint.ip && cnt > 1) {
			line += " (текущий)";
		}
		html += line + '<br>';
	}
	if (is_proxy) {
		let proxy_name = background.known_proxy_name[is_proxy] || 'Вы используете прокси';
		html+=('<font color="#0000ff">'+proxy_name+'</font><br>');
	}
	document.getElementById("dns_ip").innerHTML = html;
}

function update_dns_records(rec) {
	for(let ip in rec.ip) {
		let status = rec.ip[ip];
		if (save_ip.ip[ip]) continue;
		save_ip.ip[ip] = status > 0 ? status : 5;
	}
	show_ip_list();
}

function update_site_status(is_up) {
	let check_site_result = document.getElementById('check_site_result');
	if (is_up === "?")
			check_site_result.innerHTML = ' <img src="/images/unknown_16.png" alt="Невозможно проверить доступность сайта." title="Невозможно проверить доступность сайта.">';
	else if (is_up) check_site_result.innerHTML = ' <img src="/images/ok.png" alt="Сайт доступен." title="Сайт доступен.">';
	else check_site_result.innerHTML = ' <img src="/images/down.png" alt="Сайт лежит." title="Сайт лежит.">';
}

let update_dns_timer;
let first_time=true; //omg!
function popup_update() {
	clearTimeout(update_dns_timer);
	let hint = background.icon_hint;
	//announcement
	if (hint.replace_text) {
		div_data.innerHTML = hint.replace_text;
		return;
	}
	html = '';
	//domain
	if (hint.hostname && !(hint.ip_info && /^\d+\.\d+\.\d+\.\d+$/.test(hint.hostname))) {
		let is_up_status = '';
		if (background.localStorage.check_site_is_online==1 && first_time) {
			let is_up = background.check_if_is_online(hint.hostname, update_site_status); //async!
			if (is_up !== undefined) {  //cached result
				setTimeout(function(){ update_site_status(is_up); },0);
			}
			else {
				is_up_status = ' <img src="/images/loading_16.gif">';
			}
		}
		add("<b>" + hint.hostname + '<span id="check_site_result">'+is_up_status+'</span></b>');
	}
	//date when was blocked by RKN
	if (hint.date) add("Дата блокировки: " + hint.date);
	//comment
	else if (hint.hostname) {
		if (!(hint.ip && hint.ip_info && hint.ip_info.ip[hint.ip] == 2))
			add("В реестре отсутствует.");
	}
	else if (hint.no_init) add('База данных не загружена.');
	else add('Это вообще не сайт.');
	if (hint.text) add(hint.text);
	//info about ip
	if (hint.ip_info) { //list of ips
		html+='<span id="dns_ip"></span>';
		let info = hint.ip_info;
		save_ip = {ip:info.ip, dns:{}};
		setTimeout(show_ip_list,0);
		let is_red;
		for (let ip in info.ip) {
			if (ip == hint.ip && info.ip[ip] == 2) {
				is_red = true;
				break;
			}
		}
		if ((info.is_error || is_red) && background.localStorage.use_httpdns == 1 && first_time) { //check dns records
			//background.console.log('check dns');
			update_dns_timer = setTimeout(function(){
				background.getDNS(hint.hostname, update_dns_records);
			},0); //next tick
		}
	}
	if (hint.reason) {
		add('<b>Причина:</b>');
		add("Гос. орган: <b>"+hint.reason.gos_organ+"</b>");
		add("Постановление: <b>"+hint.reason.postanovlenie+"</b>");
	}
	if (hint.ip_info && hint.ip_info.reason[hint.ip]) {
		let reason = hint.ip_info.reason[hint.ip];
		if (!hint.reason || hint.reason.postanovlenie != reason.postanovlenie ) {
			add('<b>Блокировка по ip:</b>');
			if (reason.mask) {
				add("<font color=red><b>"+reason.mask+"</b></font>");
			}
			add("Гос. орган: <b>"+reason.gos_organ+"</b>");
			add("Постановление: <b>"+reason.postanovlenie+"</b>");
		}
	}
	if (hint.is_whitelist_domain) add('<span class=whitelist>Домен в белом списке РКН</span>');
	else if (hint.is_whitelist_ip) add('<span class=whitelist>ip-адрес в белом списке РКН</span>');
	else if (hint.is_whitelist_ip_local) add('<span class=whitelist>Локальный ip-адрес</span>');
	else if (hint.permanently_blocked) add('<span class=permanently_blocked>Вечная блокировка</span>');
	div_data.innerHTML = html;
	first_time = false;
}

let div_data;
document.addEventListener('DOMContentLoaded', function () {
	//background.console.log('show');
	div_data = document.getElementById('data');
	background.popup_update_unsafe = popup_update; //will recieve updated data
	popup_update(); //update now (initialize)
	background.popup = window;
})


