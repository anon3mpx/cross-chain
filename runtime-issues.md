forge script config/foundry/scripts/DeployAll.s.sol:DeployAll   --config-path config/foundry.toml   --rpc-url "$RPC_URL"   --broadcast -vvv
Error: Internal transport error: Socket operation on non-socket (os error 38) with /Users/ganadhish/code/work/ruflo/
Ganadhishs-MacBook-Air:ruflo ganadhish$ docker compose -f config/docker/docker-compose.testnet.yml up --build -d
unable to get image 'docker-api': Cannot connect to the Docker daemon at unix:///Users/ganadhish/.docker/run/docker.sock. Is the docker daemon running?
Ganadhishs-MacBook-Air:ruflo ganadhish$ docker compose -f config/docker/docker-compose.testnet.yml up --build -d
[+] Running 24/24
 ✔ redis Pulled                                                                                                14.6s 
   ✔ b391ede473c2 Pull complete                                                                                 0.7s 
   ✔ a447a5de8f4e Pull complete                                                                                 2.6s 
   ✔ 9cd97655d7b1 Pull complete                                                                                 1.4s 
   ✔ b6fd4f7e9d8b Pull complete                                                                                 0.8s 
   ✔ f2eae7365acd Pull complete                                                                                 7.2s 
   ✔ af7a28e20324 Pull complete                                                                                 1.1s 
   ✔ 246655120559 Pull complete                                                                                 1.2s 
   ✔ 4f4fb700ef54 Pull complete                                                                                 0.0s 
   ✔ 424ed68a579b Download complete                                                                             0.0s 
   ✔ 34ac65268e22 Download complete                                                                             0.0s 
 ✔ postgres Pulled                                                                                             31.2s 
   ✔ b06d9135182e Pull complete                                                                                 1.4s 
   ✔ 3d8f3437ce1b Pull complete                                                                                23.8s 
   ✔ 4328d592a54b Pull complete                                                                                 1.3s 
   ✔ 49b582240ca8 Pull complete                                                                                 1.4s 
   ✔ 08bb20b6ce3e Pull complete                                                                                 1.5s 
   ✔ 916f1ad40c12 Pull complete                                                                                 1.9s 
   ✔ 79adb56125dd Pull complete                                                                                 1.4s 
   ✔ 7419a9c52e02 Pull complete                                                                                 1.5s 
   ✔ 3d85c14803ff Pull complete                                                                                 1.1s 
   ✔ 58563aacf9ee Pull complete                                                                                 1.4s 
   ✔ b2e8f55ae2fa Download complete                                                                             0.0s 
   ✔ 7efa8dcabfca Download complete                                                                             0.0s 
[+] Building 13.1s (9/12)                                                                                            
 => [internal] load local bake definitions                                                                      0.0s
 => => reading from stdin 959B                                                                                  0.0s
 => [api internal] load build definition from Dockerfile                                                        0.0s
 => => transferring dockerfile: 257B                                                                            0.0s
 => [api internal] load metadata for docker.io/library/node:20-alpine                                           3.2s
 => [api internal] load .dockerignore                                                                           0.0s
 => => transferring context: 2B                                                                                 0.0s
 => [worker 1/7] FROM docker.io/library/node:20-alpine@sha256:f598378b5240225e6beab68fa9f356db1fb8efe55173e6d4  8.9s
 => => resolve docker.io/library/node:20-alpine@sha256:f598378b5240225e6beab68fa9f356db1fb8efe55173e6d4d815311  0.0s
 => => sha256:c69c795ade96b2555279aec6c4e1feb15121f7768b8605e08e80e1955bc2fa01 1.26MB / 1.26MB                  1.3s
 => => sha256:7707c14542676ced22726a42d44be628fbe11367b5d7c9e15f3897bd3bb999d8 443B / 443B                      0.7s
 => => sha256:1a429157054c3aaeb4d0677bb9ba073d16feca45349b404c96edc83dd1905db9 43.55MB / 43.55MB                8.4s
 => => extracting sha256:1a429157054c3aaeb4d0677bb9ba073d16feca45349b404c96edc83dd1905db9                       0.4s
 => => extracting sha256:c69c795ade96b2555279aec6c4e1feb15121f7768b8605e08e80e1955bc2fa01                       0.0s
 => => extracting sha256:7707c14542676ced22726a42d44be628fbe11367b5d7c9e15f3897bd3bb999d8                       0.0s
 => [api internal] load build context                                                                           0.0s
 => => transferring context: 636.23kB                                                                           0.0s
 => [worker 2/7] WORKDIR /app                                                                                   0.2s
 => [worker 3/7] COPY package.json package-lock.json ./                                                         0.0s
 => ERROR [worker 4/7] RUN npm ci                                                                               0.5s
------                                                                                                               
 > [worker 4/7] RUN npm ci:                                                                                          
0.473 npm warn EBADENGINE Unsupported engine {                                                                       
0.473 npm warn EBADENGINE   package: 'pipenet@1.4.0',                                                                
0.473 npm warn EBADENGINE   required: { node: '>=22.0.0' },
0.473 npm warn EBADENGINE   current: { node: 'v20.20.2', npm: '10.8.2' }
0.473 npm warn EBADENGINE }
0.487 npm error code EUSAGE
0.487 npm error
0.487 npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
0.487 npm error
0.487 npm error Missing: acorn@8.16.0 from lock file
0.487 npm error
0.487 npm error Clean install a project
0.487 npm error
0.487 npm error Usage:
0.487 npm error npm ci
0.487 npm error
0.487 npm error Options:
0.487 npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]
0.487 npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]]
0.487 npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]]
0.487 npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit]
0.487 npm error [--no-bin-links] [--no-fund] [--dry-run]
0.487 npm error [-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
0.487 npm error [-ws|--workspaces] [--include-workspace-root] [--install-links]
0.487 npm error
0.487 npm error aliases: clean-install, ic, install-clean, isntall-clean
0.487 npm error
0.487 npm error Run "npm help ci" for more info
0.488 npm notice
0.488 npm notice New major version of npm available! 10.8.2 -> 11.12.1
0.488 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.12.1
0.488 npm notice To update run: npm install -g npm@11.12.1
0.488 npm notice
0.488 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-04-10T13_20_19_308Z-debug-0.log
------
Dockerfile:5

--------------------

   3 |     WORKDIR /app

   4 |     COPY package.json package-lock.json ./

   5 | >>> RUN npm ci

   6 |     

   7 |     COPY src ./src

--------------------

target api: failed to solve: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1




cast call 0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D66 "canonicalInterchainTokenId(address)(bytes32)" 0xA2Ba06a76eC793d1Faf23Cc8220A887402b27331 --rpc-url https://sepolia-rollup.arbitrum.io/rpc

cast call 0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C "registeredTokenAddress(bytes32)(address)" 0x8f709b1b855776b4b59998cdbc16a25da06fa45245f3c3e529171bbd76a2ea72 --rpc-url https://sepolia-rollup.arbitrum.io/rpc