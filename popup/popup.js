let background = chrome.extension.getBackgroundPage();

let html;
function add(info) {
	html += info + "<br>\n";
}


function get_ip_list() {
	//background.console.log('show_ip_list');
	let hint = background.icon_hint;
	let html = '';
	let proxy_index;
	for(let ip in hint.ip_arr) {
		if (ip == hint.hostname) continue;
		if (hint.reason_ip && ip == hint.reason_ip.mask) continue;
		let line = ip;
		let status = hint.ip_arr[ip];
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


function update_site_status(is_up_rec) {
	let hint = background.icon_hint;
	if (hint.real_domain != is_up_rec.hostname) return;
	let check_site_result = document.getElementById('check_site_result');
	if (!check_site_result) return background.console.warn('No check_site_result!'); //jj
	const is_up = is_up_rec.result;
	if (is_up === "?")
		check_site_result.innerHTML = ' <img src="/images/unknown_16.png" alt="Невозможно проверить доступность сайта." title="Невозможно проверить доступность сайта.">';
	else if (is_up===true) check_site_result.innerHTML = ' <img src="/images/ok.png" alt="Сайт доступен." title="Сайт доступен.">';
	else if(is_up===false) check_site_result.innerHTML = ' <img src="/images/down.png" alt="Сайт лежит." title="Сайт лежит.">';
	else check_site_result.innerHTML = ' [error]';
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
		let is_up_status = '';
		if (background.localStorage.check_site_is_online==1) {
			is_up_status = ' <img src="/images/loading_16.gif">';
		}
		let style = '';
		if (hint.domain_blocked) style=' class=red';
		else if (hint.is_ip_blocked > 1) style = ' class=green';
		add("<b><span"+style+">"
			+ hint.hostname + '</span><span id="check_site_result">'+is_up_status+'</span></b>');
	}
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
	html+=get_ip_list();
	if (hint.reason) {
		add('<b>Причина:</b>');
		add("Гос. орган: <b>"+hint.reason.gos_organ+"</b>");
		add("Постановление: <b>"+hint.reason.postanovlenie+"</b>");
	}
	if (hint.reason_ip) {
		let reason = hint.reason_ip;
		if (!hint.reason || hint.reason.postanovlenie != reason.postanovlenie ) {
			add('<b>Блокировка по ip:</b>');
			if (reason.mask) {
				add("Подсеть: <font color=red>"+reason.mask+"</font>");
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
}

let div_data;
document.addEventListener('DOMContentLoaded', function () {
	//background.console.log('show');
	div_data = document.getElementById('data');
	background.popup_update_unsafe = popup_update; //will recieve updated data
	popup_update(); //update now (initialize)
	background.onPopupOpen(window);
})


