//------------- CHECK IF SITE IS ONLINE -----------------

let is_up_cache = {}; // {time:123, result:true}
const IS_UP_CACHE_TIMEOUT = 150000;

function check_if_is_online_cached(hostname) { //1 - online, 2-offline, 3-unknown, 4-loading
	//console.log("check is cached",hostname);
	if (is_up_cache[hostname]) {
		let cache = is_up_cache[hostname];
		let now = (new Date()).getTime();
		if (now - cache.time < IS_UP_CACHE_TIMEOUT) {
			//console.log(cache.result);
			return cache.result;
		}
	}
	return 4;
}

function check_if_is_online(hostname, callback_update_site_status) {
	//console.log("check is online",hostname);
	if (is_up_cache[hostname]) {
		let now = (new Date()).getTime();
		if (now - is_up_cache[hostname].time < IS_UP_CACHE_TIMEOUT) {
			setTimeout(()=>{ 
				try {
					callback_update_site_status({hostname:hostname, result:is_up_cache[hostname].result});
				} catch(e) {}
			},0);
			return
		}
	}
	let xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (this.readyState == 4) {
			//console.log("success");
			let result;
			if (this.status != 200) result = 3;
			else if (xhr.responseText.indexOf('looks down from here') > -1 || xhr.responseText.indexOf("It's not just you!") > -1) { //down
				result = 2;
			} else if (xhr.responseText.indexOf(' is up') > -1 || xhr.responseText.indexOf("It's just you.") > -1) { //up
				result = 1;
			} else result = 3;
			is_up_cache[hostname] = {
				time: (new Date()).getTime(),
				result: result,
			}
			try {
				callback_update_site_status({hostname:hostname,result:result});
			} catch(e) {
				//window dead (firefox)
			}
		}
	};
	xhr.open("GET", 'https://downforeveryoneorjustme.com/'+hostname, true);
	xhr.send();
}