//------------- CHECK IF SITE IS ONLINE -----------------

let is_up_cache = {}; // {time:123, result:true}
function check_if_is_online(hostname, callback_update_site_status) {
	//console.log("check is online",hostname);
	if (is_up_cache[hostname]) {
		let now = (new Date()).getTime();
		if (now - is_up_cache[hostname].time < 30000) {
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
		if (this.readyState == 4) { //debug
			if (this.status == 200) ;//console.log("is_up",JSON_parse(xhr.responseText));
			else console.log("is_up ERROR",this.status,xhr.responseText);
		}
		if (this.readyState == 4 && this.status == 200) {
			//console.log("success");
			let result;
			if (xhr.responseText.indexOf('looks down from here') > -1 || xhr.responseText.indexOf("It's not just you!") > -1) { //down
				result = false;
			} else if (xhr.responseText.indexOf(' is up') > -1 || xhr.responseText.indexOf("It's just you.") > -1) { //up
				result = true;
			} else result = "?";
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