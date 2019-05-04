//------------- CHECK IF SITE IS ONLINE -----------------

let is_up_cache = {}; // {time:123, result:true}
const IS_UP_CACHE_TIMEOUT = 150000;
const IS_UP_CACHE_DN_TIMEOUT = 9000;

function check_if_is_online_cached(hostname) { //1 - online, 2-offline, 3-unknown, 4-loading
	//console.log("check is cached",hostname);
	if (is_up_cache[hostname]) {
		let cache = is_up_cache[hostname];
		let now = (new Date()).getTime();
		if (now - cache.time < IS_UP_CACHE_TIMEOUT || cache.result != 1 && now - cache.time < IS_UP_CACHE_DN_TIMEOUT) {
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
		//{"http":{"ip":"87.250.250.242","tm":0.05,"http":302,"rd":1,"res":3},"https":{"ip":"87.250.250.242","tm":0.16,"http":200,"e":42,"res":1}}
		if (this.readyState == 4) {
			//console.log("success");
			let result;
			if (this.status != 200) result = 3; //unknown
			else {
				try {
					let data = JSON.parse(xhr.responseText);
					if (data.http.res < 0 || data.https.res < 0) {
						console.log('check online error: ',xhr.responseText);
					}
					if (data.http.res >=5 && data.https.res >= 5) result = 2; //bad
					else if (data.http.res <=4 && data.http.res > 0 || data.https.res <=4 && data.https.res > 0) result = 1; //good
					else console.log(result = 3, xhr.responseText); //impossible
				}
				catch(e) { result = 3; }
			}
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
	xhr.open("GET", 'http://h139775.s08.test-hf.su/ask-check.php?u='+hostname, true);
	xhr.send();
}