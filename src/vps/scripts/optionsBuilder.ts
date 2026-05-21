import {Options} from '@layerzerolabs/lz-v2-utilities';

const optionsLzReceive = Options.newOptions().addExecutorLzReceiveOption(200000, 0).addExecutorComposeOption(0, 400000, 0).toHex();

console.log('Options hex:', optionsLzReceive);