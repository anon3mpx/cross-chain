docker logs 64343a07f9fc --tail 100

> empx-cross-chain-vps-runtime@1.0.0 vps:worker
> tsx src/vps/app/worker.ts

[CCTP Relay] started
[LayerZero Value Transfer API Monitor] started
[GasZip Monitor] started
[THORChain Monitor] started
[RecoveryEngine] Started — checking every 30 s
[VPS Worker] running eventMonitor=true recovery=true rails="CCTP_STANDARD=worker CCTP_FAST=worker CCTP_STANDARD=disabled AXELAR=passive LAYERZERO=worker VIA_LABS=passive WORMHOLE=passive GASZIP=worker THORCHAIN=worker"
[CCTP Relay] message already relayed intent=0x3cec2c1c15114248dd0f49e9ba5621b24718e90c5b784a0f7834ab346962ae72
[CCTP Relay] receiver already settled intent=0x3cec2c1c15114248dd0f49e9ba5621b24718e90c5b784a0f7834ab346962ae72
[VPS Worker] fatal rejection AggregateError [ETIMEDOUT]: 
    at internalConnectMultiple (node:net:1193:18)
    at internalConnectMultiple (node:net:1269:5)
    at Timeout.internalConnectMultipleTimeout (node:net:1810:5)
    at listOnTimeout (node:internal/timers:607:11)
    at process.processTimers (node:internal/timers:541:7) {
  code: 'ETIMEDOUT',
  [errors]: [
    Error: connect ETIMEDOUT 172.66.171.45:443
        at createConnectionError (node:net:1746:14)
        at Timeout.internalConnectMultipleTimeout (node:net:1805:38)
        at listOnTimeout (node:internal/timers:607:11)
        at process.processTimers (node:internal/timers:541:7) {
      errno: -110,
      code: 'ETIMEDOUT',
      syscall: 'connect',
      address: '172.66.171.45',
      port: 443
    },
    Error: connect ENETUNREACH 2606:4700:10::ac42:ab2d:443 - Local (:::0)
        at internalConnectMultiple (node:net:1265:16)
        at Timeout.internalConnectMultipleTimeout (node:net:1810:5)
        at listOnTimeout (node:internal/timers:607:11)
        at process.processTimers (node:internal/timers:541:7) {
      errno: -101,
      code: 'ENETUNREACH',
      syscall: 'connect',
      address: '2606:4700:10::ac42:ab2d',
      port: 443
    },
    Error: connect ETIMEDOUT 104.20.39.96:443
        at createConnectionError (node:net:1746:14)
        at Timeout.internalConnectMultipleTimeout (node:net:1805:38)
        at listOnTimeout (node:internal/timers:607:11)
        at process.processTimers (node:internal/timers:541:7) {
      errno: -110,
      code: 'ETIMEDOUT',
      syscall: 'connect',
      address: '104.20.39.96',
      port: 443
    },
    Error: connect ENETUNREACH 2606:4700:10::6814:2760:443 - Local (:::0)
        at internalConnectMultiple (node:net:1265:16)
        at Timeout.internalConnectMultipleTimeout (node:net:1810:5)
        at listOnTimeout (node:internal/timers:607:11)
        at process.processTimers (node:internal/timers:541:7) {
      errno: -101,
      code: 'ENETUNREACH',
      syscall: 'connect',
      address: '2606:4700:10::6814:2760',
      port: 443
    }
  ]
}

> empx-cross-chain-vps-runtime@1.0.0 vps:worker
> tsx src/vps/app/worker.ts

[CCTP Relay] started
[LayerZero Value Transfer API Monitor] started
[GasZip Monitor] started
[THORChain Monitor] started
[RecoveryEngine] Started — checking every 30 s
[VPS Worker] running eventMonitor=true recovery=true rails="CCTP_STANDARD=worker CCTP_FAST=worker CCTP_STANDARD=disabled AXELAR=passive LAYERZERO=worker VIA_LABS=passive WORMHOLE=passive GASZIP=worker THORCHAIN=worker"
[CCTP Relay] message already relayed intent=0x3cec2c1c15114248dd0f49e9ba5621b24718e90c5b784a0f7834ab346962ae72
[CCTP Relay] receiver already settled intent=0x3cec2c1c15114248dd0f49e9ba5621b24718e90c5b784a0f7834ab346962ae72
root@srv1107265:/home/ubuntu/projects/cross-chain# docker ps -a
CONTAINER ID   IMAGE                        COMMAND                  CREATED         STATUS                    PORTS                                                                                             NAMES
e6199972a5c6   caddy:2-alpine               "caddy run --config …"   6 minutes ago   Up 6 minutes              0.0.0.0:80->80/tcp, [::]:80->80/tcp, 0.0.0.0:443->443/tcp, [::]:443->443/tcp, 443/udp, 2019/tcp   empx-cross-chain-caddy
64343a07f9fc   empx-cross-chain-vps:local   "docker-entrypoint.s…"   6 minutes ago   Up About a minute                                                                                                           empx-cross-chain-worker
0c2a6819a352   empx-cross-chain-vps:local   "docker-entrypoint.s…"   6 minutes ago   Up 6 minutes              127.0.0.1:8787->8787/tcp                                                                          empx-cross-chain-api
fac79a8b3928   swaggerapi/swagger-ui        "/docker-entrypoint.…"   6 days ago      Up 30 minutes             80/tcp, 127.0.0.1:8081->8080/tcp                                                                  empx-cross-chain-swagger-ui
887f6389ff39   adminer:latest               "entrypoint.sh docke…"   6 days ago      Up 30 minutes             127.0.0.1:8080->8080/tcp                                                                          empx-cross-chain-adminer
885ca6f84e9e   postgres:16-alpine           "docker-entrypoint.s…"   6 days ago      Up 30 minutes (healthy)   127.0.0.1:5432->5432/tcp                                                                          empx-cross-chain-postgres
3d95c379851b   redis:7-alpine               "docker-entrypoint.s…"   6 days ago      Up 30 minutes (healthy)   127.0.0.1:6379->6379/tcp                                                                          empx-cross-chain-redis