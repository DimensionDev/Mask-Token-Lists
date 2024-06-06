import { Provider } from '@/providers/types/Ticker';
import { Token } from '@/types';

export class Ticker implements Provider {
    async getTicker(token: Token) {
        return null;
    }
}
