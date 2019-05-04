
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
	//return decodeURIComponent(encoded.replace(/\+/g,	" "));
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
	'rutracker.org':1,'rutracker.net':1,'rutracker.cr':1,'rutracker.nl':1, 'rutracker.me':1,
	'nnm-club.me':1, 'nnmclub.to':1,
	'rutor.info':1, 'rutor.is':1,
	'fast-torrent.ru':1, 'rustorka.com':1,
	//13.11.2017 +10
	'kinoprofi-online.club':1, 'bigcinema.club':1, 'vmuzike.ru':1, 'kinoleila.ru':1,
	'my-hit.fm':1, 'kinobar.cc':1, 'bigcinema-online.ru':1, 'muzuka.me':1, 'kinogo-net.co':1,
}


//


//bad domains
const bad_domains = {
	//'rutracker.in':1, 'rutracker-pro.ru':1, 'rutracker2.org':1, //'9186748.ru':1,
	'tor-browser.ru':1, 'tor-project.ru':1,
	'new-rutor.org':1, 'xrutor.org':1, '37.1.207.65':1, 'rutorx.info':1, 'live-rutor.org':1, 
	'rss.new-rutor.org':1, 'orutor.org':1, 'rutorka.org':1, 'wwwx.xrutor.org':1, 'rutor-info.ru':1,
	'kinozal-tv.appspot.com':1,  'kinozal-me.appspot.com':1, 'a-dot-kinozal-tv.appspot.com':1,
	'forum-kinozal.appspot.com':1, 'kinozal-zerkalo.appspot.com':1,
	'forum-kinozal-tv.appspot.com':1,
	'rutorgame.info':1, '222ccfc.123torrent.org':1, 'rutor.unblocklab.stream':1, 'rutorg.host':1,
	'new-rutor.club':1, //'rutororg-mirror.ru':1, 
	'new-rutor.info':1, 'pipitor.org':1, 'freedom-tor.ru':1, 'rutor.unblocklab.faith':1,
	'rutor.sitescrack.bid':1, 'rutorinfo.ru':1, 'brutor.org':1, 'h97870vq.bget.ru':1,
	'rutor-is.prox.fun':1, 'rutor.unblocklab.site':1, '222b.123torrent.org':1, 'newrutor.net.pl':1,
	'hd-bit.net':1, 'liverutor.net.pl':1, 'newrutor.org.pl':1, 
	'booktracker-org.appspot.com':1,
	'maintracker.org':1, 'rutrckr.com':1, 'main-tracker.ru':1, '1.maintracker.org':1, 
	'un-censored.appspot.com':1, 'cr-dot-rutrckr.appspot.com':1, '9186748.ru':1, 'tokakoka.tk':1,
	'rutreker-2018.org':1, 'gostracker.xyz':1,
};
const bad_domain_whitelist = {
	'rutracker.wiki':1, 'rutracker.news':1, 'rutracker.org':1, 'rutracker.net':1, 'rutracker.cr':1, 'rutracker.nl':1, 'rutracker.me':1,
	'rutrackerripnext.onion':1, 'rutracker.lib':1, 'rutracker.i2p':1,
	'free-rutor.org':1, 'tor-ru.net':1, 
	'kinozal.guru':1, 'kinozal.me':1, 
	'rustorka.net':1, 'rustorka.com':1,
}




