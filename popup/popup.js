let background = chrome.extension.getBackgroundPage();

let html;
function add(info) {
	html += info + "<br>\n";
}

let is_show_blockip_notice;
function get_ip_list() {
	//background.console.log('show_ip_list');
	let hint = background.icon_hint;
	let html = '';
	let proxy_index;
	for(let ip in hint.ip_arr) {
		let status = hint.ip_arr[ip];
		if (ip == hint.hostname && (status == 0 || status == 5)) continue;
		if (is_show_blockip_notice && ip == hint.reason_ip.mask) continue;
		let line = ip;
		if (status == 1) line = '<font color="#ff8e00">'+line+'</font>';
		else if (status == 2) line = '<font color="#ff0000">'+line+'</font>';
		else if (status == 5) line = '<font color="#00bb00">'+line+'</font>';
		if (background.known_proxy_ip[ip]) { //proxy may be blocked
			line = '<font color="#0000ff">('+line+')</font>';
			if (ip == hint.ip) proxy_index = background.known_proxy_ip[ip];
		}
		line = '<b>'+line+'</b>';
		if (ip == hint.ip) {
			line += " (текущий)";
		}
		html += line + '<br>';
	}
	if (proxy_index) {
		let proxy_name = background.known_proxy_name[proxy_index] || 'Вы используете прокси';
		html+=('<font color="#0000ff">'+proxy_name+'</font><br>');
	}
	return html;
}

function get_is_online_str (num) {
	if (num == 1) return ' <img src="/images/ok.png" alt="Сайт доступен." title="Сайт доступен.">';
	if (num == 2) return ' <img src="/images/down.png" alt="Сайт лежит." title="Сайт лежит.">';
	if (num == 3) return ' <img src="/images/unknown_16.png" alt="Невозможно проверить доступность сайта." title="Невозможно проверить доступность сайта.">';
	if (num == 4) return ' <img src="/images/loading_16.gif">';
	return '';
}

function update_site_status(is_up_rec) {
	let hint = background.icon_hint;
	if (hint.real_domain != is_up_rec.hostname) return;
	let check_site_result = document.getElementById('check_site_result');
	if (!check_site_result) return background.console.warn('No check_site_result!'); //jj
	check_site_result.innerHTML = get_is_online_str(is_up_rec.result);
}

function update_whois(whois) {
	let hint = background.icon_hint;
	if (hint.real_domain != whois.domain) return;
	let whois_element = document.getElementById('whois_element');
	if (!whois_element) return background.console.warn('No whois_element!');
	whois_element.innerHTML = 'Возраст: ' + whois.result + '<br>';
}

function clearString(str) {
  return str.length < 12 ? str : (' ' + str).slice(1);
}

function antizapretSet(text) {
	document.getElementById('antizapret').innerText = text;
}
function antizapretUpdate() {
	let now = (new Date()).getTime();
	if (now - background.localStorage.az_tm < 60000 && background.localStorage.az_data) {
		setTimeout(e=>antizapretSet(background.localStorage.az_data),0);
		return;
	}
	let xhr = new XMLHttpRequest();
	xhr.open("GET", "https://antizapret.prostovpn.org/donate.html", true);
	xhr.onload = function (e) {
		if (xhr.readyState === 4) {
			if (xhr.status === 200) {
				//console.log(xhr.responseText);
				let m = xhr.responseText.match(/<p>Собрано: ([^<]*)<\/p>/);
				if (!m) return;
				let txt = m[1].trim().replace('<','&lt;');
				if (txt.length > 50) return;
				background.localStorage.az_data = txt;
				background.localStorage.az_tm = now;
				antizapretSet(clearString(txt));
			} else {
				//console.error(xhr.statusText);
			}
		}
	};
	xhr.onerror = function (e) {
		//console.error(xhr.statusText);
	};
	xhr.send(null);	
}

function popup_update() {
	let hint = background.icon_hint;
	//announcement
	if (hint.replace_text) {
		div_data.innerHTML = hint.replace_text;
		return;
	}
	html = '';
	//domain
	if (hint.hostname) { // && !(hint.ip && /^\d+\.\d+\.\d+\.\d+$/.test(hint.hostname))) {
		let is_up_status = get_is_online_str(hint.check_is_online); //1 - online, 2-offline, 3-unknown, 4-loading
		let style = '';
		if (hint.domain_blocked) style=' class=red';
		else if (hint.is_ip_blocked > 1) style = ' class=green';
		add("<b><span"+style+">"
			+ hint.hostname + '</span><span id="check_site_result">'+is_up_status+'</span></b>');
	}
	//fishing
	if (hint.official) add('<font color=#77f><b>Официальный сайт</b></font>');
	else if (hint.is_fishing) add('<font color=red><b>Фишинговый сайт!</b></font>');
	else if (hint.is_personal_mirror) add('<font color=#77f><b>Персональное зеркало</b></font>');
	else if (hint.not_fishing) add('<font color=#77f><b>Официальное зеркало</b></font>');
	//whois
	let whois_str = hint.whois && ('Возраст: ' + hint.whois.result + '<br>') || '';
	html+='<span id="whois_element">' + whois_str + '</span>';
	//date when was blocked by RKN
	if (hint.date) add("Дата блокировки: " + hint.date);
	//comment
	else if (hint.hostname) {
		if (!(hint.is_ip_blocked > 0))
			add("В реестре отсутствует.");
	}
	else if (hint.no_init) add('База данных не загружена.');
	else add('Это вообще не сайт.');
	if (hint.text) add(hint.text);
	//info about ip
	is_show_blockip_notice = hint.reason_ip && (!hint.reason || hint.reason.postanovlenie != hint.reason_ip.postanovlenie );
	html+=get_ip_list();
	if (hint.reason) {
		add('<b>Причина:</b>');
		add("Гос. орган: <b>"+hint.reason.gos_organ+"</b>");
		add("Постановление: <b>"+hint.reason.postanovlenie+"</b>");
	}
	if (is_show_blockip_notice) {
		let reason = hint.reason_ip;
		add('<b>Блокировка по ip:</b>');
		if (reason.mask) {
			add("Подсеть: <font color=red>"+reason.mask+"</font>");
		}
		add("Гос. орган: <b>"+reason.gos_organ+"</b>");
		add("Постановление: <b>"+reason.postanovlenie+"</b>");
	}
	if (hint.is_whitelist_domain) add('<span class=whitelist>Домен в белом списке РКН</span>');
	else if (hint.is_whitelist_ip) add('<span class=whitelist>ip-адрес в белом списке РКН</span>');
	else if (hint.is_whitelist_ip_local) add('<span class=whitelist>Локальный ip-адрес</span>');
	else if (hint.permanently_blocked) add('<span class=permanently_blocked>Вечная блокировка</span>');
	if (background.localStorage.show_donate==1) {
		html+='<span id="antizapret" style="margin-top:2px;display:block;"></span>';
		antizapretUpdate();
	}
	div_data.innerHTML = html;
}

let div_data;
document.addEventListener('DOMContentLoaded', function () {
	//background.console.log('show');
	div_data = document.getElementById('data');
	background.popup_update_unsafe = popup_update; //will recieve updated data
	popup_update(); //update now (initialize)
	background.onPopupOpen(window);
})


