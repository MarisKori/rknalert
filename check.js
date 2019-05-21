let d=document;
function report(name,b) {
	chrome.runtime.sendMessage({
		type: "report",
		name: name,
		status: b,
		host: location.hostname,
	});
}

function checkRuTracker() {
	for(let e of d.head.querySelectorAll('link')) {
		if (e.href.indexOf('//static.t-ru.org/') > -1) return report('rutracker',1);
		if (e.title=="Поиск на RuTracker.org") return report('rutracker',0);
	}
}

function checkTitle(l) {
	if (l.indexOf('rutracker.org') > -1 || l.match(/\brutracker\b/)) checkRuTracker();
	else if (l.indexOf('зеркало rutor.info ') === 0) report('rutor',1);
	else if (l.match(/(?:[^\w]|^)rutor\.org\b/) || l.match(/^rutor\b/)) report('rutor',0);
	else if (l.indexOf(' :: nnm-club')> -1) report('nnmclub',0);
	else {
		for(let e of d.head.querySelectorAll('link')) {
			if (e.rel == 'search' && e.title && e.title.toLowerCase().indexOf('rutracker.org') > -1)
				return checkRuTracker();
		}
	}
}

let obs = new MutationObserver(L=>{
	if (d.body && d.head) {
		let tag = d.head.querySelector('title');
		if (tag) {
			checkTitle(tag.innerText.toLowerCase());
			obs.disconnect();
		}
	}
});
obs.observe(d.documentElement, {childList: true});
