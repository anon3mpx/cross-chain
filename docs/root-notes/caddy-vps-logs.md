docker logs empx-cross-chain-caddy --tail 50
{"level":"info","ts":1779451054.0246835,"msg":"maxprocs: Leaving GOMAXPROCS=2: CPU quota undefined"}
{"level":"info","ts":1779451054.0247207,"msg":"GOMEMLIMIT is updated","GOMEMLIMIT":7494908313,"previous":9223372036854775807}
{"level":"info","ts":1779451054.0247247,"msg":"using config from file","file":"/etc/caddy/Caddyfile"}
{"level":"info","ts":1779451054.0247276,"msg":"adapted config to JSON","adapter":"caddyfile"}
{"level":"info","ts":1779451054.0258973,"logger":"admin","msg":"admin endpoint started","address":"localhost:2019","enforce_origin":false,"origins":["//localhost:2019","//[::1]:2019","//127.0.0.1:2019"]}
{"level":"info","ts":1779451054.0262346,"logger":"http.auto_https","msg":"server is listening only on the HTTPS port but has no TLS connection policies; adding one to enable TLS","server_name":"srv0","https_port":443}
{"level":"info","ts":1779451054.026297,"logger":"http.auto_https","msg":"enabling automatic HTTP->HTTPS redirects","server_name":"srv0"}
{"level":"info","ts":1779451054.0263536,"logger":"tls.cache.maintenance","msg":"started background certificate maintenance","cache":"0x3af23b485300"}
{"level":"info","ts":1779451054.0267227,"logger":"http","msg":"enabling HTTP/3 listener","addr":":443"}
{"level":"info","ts":1779451054.026887,"msg":"failed to sufficiently increase receive buffer size (was: 208 kiB, wanted: 7168 kiB, got: 416 kiB). See https://github.com/quic-go/quic-go/wiki/UDP-Buffer-Sizes for details."}
{"level":"info","ts":1779451054.0270116,"logger":"http.log","msg":"server running","name":"srv0","protocols":["h1","h2","h3"]}
{"level":"warn","ts":1779451054.0270915,"logger":"http","msg":"HTTP/2 skipped because it requires TLS","network":"tcp","addr":":80"}
{"level":"warn","ts":1779451054.0271137,"logger":"http","msg":"HTTP/3 skipped because it requires TLS","network":"tcp","addr":":80"}
{"level":"info","ts":1779451054.0271175,"logger":"http.log","msg":"server running","name":"remaining_auto_https_redirects","protocols":["h1","h2","h3"]}
{"level":"info","ts":1779451054.0271225,"logger":"http","msg":"enabling automatic TLS certificate management","domains":["bridge.empx.io"]}
{"level":"info","ts":1779451054.0273726,"msg":"autosaved config (load with --resume flag)","file":"/config/caddy/autosave.json"}
{"level":"info","ts":1779451054.0273871,"msg":"serving initial configuration"}
{"level":"info","ts":1779451054.0295465,"logger":"tls.obtain","msg":"acquiring lock","identifier":"bridge.empx.io"}
{"level":"info","ts":1779451054.0306194,"logger":"tls","msg":"storage cleaning happened too recently; skipping for now","storage":"FileStorage:/data/caddy","instance":"5cdb987e-567d-400c-a161-89d7b1f2d381","try_again":1779537454.030617,"try_again_in":86399.9999997}
{"level":"info","ts":1779451054.0310686,"logger":"tls","msg":"finished cleaning storage units"}
{"level":"info","ts":1779451054.031509,"logger":"tls.obtain","msg":"lock acquired","identifier":"bridge.empx.io"}
{"level":"info","ts":1779451054.0316298,"logger":"tls.obtain","msg":"obtaining certificate","identifier":"bridge.empx.io"}
{"level":"info","ts":1779451054.0321696,"logger":"http","msg":"creating new account because no account for configured email is known to us","email":"","ca":"https://acme-v02.api.letsencrypt.org/directory","error":"open /data/caddy/acme/acme-v02.api.letsencrypt.org-directory/users/default/default.json: no such file or directory"}
{"level":"info","ts":1779451054.0322208,"logger":"http","msg":"ACME account has empty status; registering account with ACME server","contact":[],"location":""}
{"level":"info","ts":1779451054.033651,"logger":"http","msg":"creating new account because no account for configured email is known to us","email":"","ca":"https://acme-v02.api.letsencrypt.org/directory","error":"open /data/caddy/acme/acme-v02.api.letsencrypt.org-directory/users/default/default.json: no such file or directory"}
{"level":"info","ts":1779451054.9284348,"logger":"http","msg":"new ACME account registered","contact":[],"status":"valid"}
{"level":"info","ts":1779451054.9337497,"logger":"http","msg":"waiting on internal rate limiter","identifiers":["bridge.empx.io"],"ca":"https://acme-v02.api.letsencrypt.org/directory","account":""}
{"level":"info","ts":1779451054.9337704,"logger":"http","msg":"done waiting on internal rate limiter","identifiers":["bridge.empx.io"],"ca":"https://acme-v02.api.letsencrypt.org/directory","account":""}
{"level":"info","ts":1779451054.9338088,"logger":"http","msg":"using ACME account","account_id":"https://acme-v02.api.letsencrypt.org/acme/acct/3359621216","account_contact":[]}
{"level":"info","ts":1779451055.3523424,"logger":"http.acme_client","msg":"trying to solve challenge","identifier":"bridge.empx.io","challenge_type":"http-01","ca":"https://acme-v02.api.letsencrypt.org/directory"}
{"level":"info","ts":1779451055.7255542,"logger":"http","msg":"served key authentication","identifier":"bridge.empx.io","challenge":"http-01","remote":"172.68.3.151:14024","distributed":false}
{"level":"info","ts":1779451055.9868922,"logger":"http","msg":"served key authentication","identifier":"bridge.empx.io","challenge":"http-01","remote":"104.23.223.120:11434","distributed":false}
{"level":"info","ts":1779451056.058005,"logger":"http","msg":"served key authentication","identifier":"bridge.empx.io","challenge":"http-01","remote":"162.159.115.37:13371","distributed":false}
{"level":"info","ts":1779451056.1677938,"logger":"http","msg":"served key authentication","identifier":"bridge.empx.io","challenge":"http-01","remote":"172.68.175.69:9862","distributed":false}
{"level":"info","ts":1779451056.2838986,"logger":"http","msg":"served key authentication","identifier":"bridge.empx.io","challenge":"http-01","remote":"172.70.208.37:12021","distributed":false}
{"level":"info","ts":1779451057.124797,"logger":"http.acme_client","msg":"authorization finalized","identifier":"bridge.empx.io","authz_status":"valid"}
{"level":"info","ts":1779451057.1248405,"logger":"http.acme_client","msg":"validations succeeded; finalizing order","order":"https://acme-v02.api.letsencrypt.org/acme/order/3359621216/513587120756"}
{"level":"info","ts":1779451059.0255668,"logger":"http.acme_client","msg":"got renewal info","names":["bridge.empx.io"],"window_start":1784554991,"window_end":1784710441,"selected_time":1784709500,"recheck_after":1779473374.0255527,"explanation_url":""}
{"level":"info","ts":1779451059.3416135,"logger":"http.acme_client","msg":"got renewal info","names":["bridge.empx.io"],"window_start":1784554991,"window_end":1784710441,"selected_time":1784705479,"recheck_after":1779471268.3416023,"explanation_url":""}
{"level":"info","ts":1779451059.3416834,"logger":"http.acme_client","msg":"successfully downloaded available certificate chains","count":2,"first_url":"https://acme-v02.api.letsencrypt.org/acme/cert/0698b9426c750e53719ed67ec43c78ece761"}
{"level":"info","ts":1779451059.3515694,"logger":"tls.obtain","msg":"certificate obtained successfully","identifier":"bridge.empx.io","issuer":"acme-v02.api.letsencrypt.org-directory"}
{"level":"info","ts":1779451059.3517008,"logger":"tls.obtain","msg":"releasing lock","identifier":"bridge.empx.io"}
root@srv1107265:/home/ubuntu/projects/cross-chain#   docker exec empx-cross-chain-caddy env | grep API_DOMAIN
API_DOMAIN=bridge.empx.io
root@srv1107265:/home/ubuntu/projects/cross-chain# curl -H "Host: bridge.empx.io" http://127.0.0.1/api/v1/health
root@srv1107265:/home/ubuntu/projects/cross-chain# 

-----

caddy logs for crosschain.empx.io

docker logs empx-cross-chain-caddy --tail 50
{"level":"info","ts":1779791487.5858612,"msg":"maxprocs: Leaving GOMAXPROCS=2: CPU quota undefined"}
{"level":"info","ts":1779791487.5858877,"msg":"GOMEMLIMIT is updated","GOMEMLIMIT":7494908313,"previous":9223372036854775807}
{"level":"info","ts":1779791487.5858924,"msg":"using config from file","file":"/etc/caddy/Caddyfile"}
{"level":"info","ts":1779791487.5858958,"msg":"adapted config to JSON","adapter":"caddyfile"}
{"level":"info","ts":1779791487.587457,"logger":"admin","msg":"admin endpoint started","address":"localhost:2019","enforce_origin":false,"origins":["//[::1]:2019","//127.0.0.1:2019","//localhost:2019"]}
{"level":"info","ts":1779791487.5876732,"logger":"http.auto_https","msg":"server is listening only on the HTTPS port but has no TLS connection policies; adding one to enable TLS","server_name":"srv0","https_port":443}
{"level":"info","ts":1779791487.587693,"logger":"http.auto_https","msg":"enabling automatic HTTP->HTTPS redirects","server_name":"srv0"}
{"level":"info","ts":1779791487.5885856,"logger":"http","msg":"enabling HTTP/3 listener","addr":":443"}
{"level":"info","ts":1779791487.5887344,"msg":"failed to sufficiently increase receive buffer size (was: 208 kiB, wanted: 7168 kiB, got: 416 kiB). See https://github.com/quic-go/quic-go/wiki/UDP-Buffer-Sizes for details."}
{"level":"info","ts":1779791487.589658,"logger":"http.log","msg":"server running","name":"srv0","protocols":["h1","h2","h3"]}
{"level":"info","ts":1779791487.5904653,"logger":"tls.cache.maintenance","msg":"started background certificate maintenance","cache":"0x2749198fee00"}
{"level":"warn","ts":1779791487.591076,"logger":"http","msg":"HTTP/2 skipped because it requires TLS","network":"tcp","addr":":80"}
{"level":"warn","ts":1779791487.591091,"logger":"http","msg":"HTTP/3 skipped because it requires TLS","network":"tcp","addr":":80"}
{"level":"info","ts":1779791487.5910945,"logger":"http.log","msg":"server running","name":"remaining_auto_https_redirects","protocols":["h1","h2","h3"]}
{"level":"info","ts":1779791487.5910988,"logger":"http","msg":"enabling automatic TLS certificate management","domains":["crosschain.empx.io"]}
{"level":"info","ts":1779791487.5915182,"msg":"autosaved config (load with --resume flag)","file":"/config/caddy/autosave.json"}
{"level":"info","ts":1779791487.5915487,"msg":"serving initial configuration"}
{"level":"info","ts":1779791487.59834,"logger":"tls.obtain","msg":"acquiring lock","identifier":"crosschain.empx.io"}
{"level":"info","ts":1779791487.6004732,"logger":"tls","msg":"storage cleaning happened too recently; skipping for now","storage":"FileStorage:/data/caddy","instance":"5cdb987e-567d-400c-a161-89d7b1f2d381","try_again":1779877887.6004705,"try_again_in":86399.999999429}
{"level":"info","ts":1779791487.6008952,"logger":"tls","msg":"finished cleaning storage units"}
{"level":"info","ts":1779791487.6016731,"logger":"tls.obtain","msg":"lock acquired","identifier":"crosschain.empx.io"}
{"level":"info","ts":1779791487.6018476,"logger":"tls.obtain","msg":"obtaining certificate","identifier":"crosschain.empx.io"}
{"level":"info","ts":1779791487.6062434,"logger":"http","msg":"waiting on internal rate limiter","identifiers":["crosschain.empx.io"],"ca":"https://acme-v02.api.letsencrypt.org/directory","account":""}
{"level":"info","ts":1779791487.6062722,"logger":"http","msg":"done waiting on internal rate limiter","identifiers":["crosschain.empx.io"],"ca":"https://acme-v02.api.letsencrypt.org/directory","account":""}
{"level":"info","ts":1779791487.6071293,"logger":"http","msg":"using ACME account","account_id":"https://acme-v02.api.letsencrypt.org/acme/acct/3359621216","account_contact":[]}
{"level":"info","ts":1779791489.4711115,"logger":"http.acme_client","msg":"trying to solve challenge","identifier":"crosschain.empx.io","challenge_type":"tls-alpn-01","ca":"https://acme-v02.api.letsencrypt.org/directory"}
{"level":"error","ts":1779791490.540184,"logger":"http.acme_client","msg":"challenge failed","identifier":"crosschain.empx.io","challenge_type":"tls-alpn-01","problem":{"type":"urn:ietf:params:acme:error:unauthorized","title":"","detail":"Cannot negotiate ALPN protocol \"acme-tls/1\" for tls-alpn-01 challenge","instance":"","subproblems":null}}
{"level":"error","ts":1779791490.5406754,"logger":"http.acme_client","msg":"validating authorization","identifier":"crosschain.empx.io","problem":{"type":"urn:ietf:params:acme:error:unauthorized","title":"","detail":"Cannot negotiate ALPN protocol \"acme-tls/1\" for tls-alpn-01 challenge","instance":"","subproblems":null},"order":"https://acme-v02.api.letsencrypt.org/acme/order/3359621216/514932140356","attempt":1,"max_attempts":3}
{"level":"info","ts":1779791491.9396563,"logger":"http.acme_client","msg":"trying to solve challenge","identifier":"crosschain.empx.io","challenge_type":"http-01","ca":"https://acme-v02.api.letsencrypt.org/directory"}
{"level":"info","ts":1779791492.383732,"logger":"http","msg":"served key authentication","identifier":"crosschain.empx.io","challenge":"http-01","remote":"162.158.90.99:11262","distributed":false}
{"level":"info","ts":1779791492.6662319,"logger":"http","msg":"served key authentication","identifier":"crosschain.empx.io","challenge":"http-01","remote":"104.23.223.12:10619","distributed":false}
{"level":"info","ts":1779791492.7555737,"logger":"http","msg":"served key authentication","identifier":"crosschain.empx.io","challenge":"http-01","remote":"104.23.243.250:9271","distributed":false}
{"level":"info","ts":1779791492.865613,"logger":"http","msg":"served key authentication","identifier":"crosschain.empx.io","challenge":"http-01","remote":"104.23.160.210:13766","distributed":false}
{"level":"info","ts":1779791492.9097037,"logger":"http","msg":"served key authentication","identifier":"crosschain.empx.io","challenge":"http-01","remote":"162.158.88.13:13598","distributed":false}
{"level":"info","ts":1779791493.8331316,"logger":"http.acme_client","msg":"authorization finalized","identifier":"crosschain.empx.io","authz_status":"valid"}
{"level":"info","ts":1779791493.8332329,"logger":"http.acme_client","msg":"validations succeeded; finalizing order","order":"https://acme-v02.api.letsencrypt.org/acme/order/3359621216/514932150376"}
{"level":"info","ts":1779791494.6719916,"logger":"http.acme_client","msg":"got renewal info","names":["crosschain.empx.io"],"window_start":1784895427,"window_end":1785050877,"selected_time":1785031072,"recheck_after":1779817274.6719787,"explanation_url":""}
{"level":"info","ts":1779791495.1036859,"logger":"http.acme_client","msg":"got renewal info","names":["crosschain.empx.io"],"window_start":1784895427,"window_end":1785050877,"selected_time":1784977781,"recheck_after":1779817002.103675,"explanation_url":""}
{"level":"info","ts":1779791495.1037533,"logger":"http.acme_client","msg":"successfully downloaded available certificate chains","count":2,"first_url":"https://acme-v02.api.letsencrypt.org/acme/cert/050c6e987c6e5bc37d8748913b11b80f7cdf"}
{"level":"info","ts":1779791495.110697,"logger":"tls.obtain","msg":"certificate obtained successfully","identifier":"crosschain.empx.io","issuer":"acme-v02.api.letsencrypt.org-directory"}
{"level":"info","ts":1779791495.1108327,"logger":"tls.obtain","msg":"releasing lock","identifier":"crosschain.empx.io"}