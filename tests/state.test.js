"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const state_1 = require("../src/state");
const db_1 = require("../src/db");
jest.mock('../src/db', () => ({
    prisma: {
        botState: {
            findUnique: jest.fn(),
            create: jest.fn(),
            upsert: jest.fn(),
        },
    },
}));
describe('state.ts Unit Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('loadState', () => {
        it('should load state successfully if it exists in DB', async () => {
            const mockDbState = {
                id: 1,
                lastProcessedPostUri: 'at://123',
                lastProcessedAt: new Date('2025-12-04T09:58:26.714Z'),
            };
            db_1.prisma.botState.findUnique.mockResolvedValue(mockDbState);
            const state = await (0, state_1.loadState)();
            expect(db_1.prisma.botState.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(state.lastProcessedPostUri).toBe('at://123');
            expect(state.lastProcessedAt).toBe('2025-12-04T09:58:26.714Z');
        });
        it('should create and return default state if it does not exist in DB', async () => {
            db_1.prisma.botState.findUnique.mockResolvedValue(null);
            db_1.prisma.botState.create.mockResolvedValue({
                id: 1,
                lastProcessedPostUri: null,
                lastProcessedAt: null,
            });
            const state = await (0, state_1.loadState)();
            expect(db_1.prisma.botState.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(db_1.prisma.botState.create).toHaveBeenCalledWith({
                data: {
                    id: 1,
                    lastProcessedPostUri: null,
                    lastProcessedAt: null,
                },
            });
            expect(state.lastProcessedPostUri).toBeNull();
            expect(state.lastProcessedAt).toBeNull();
        });
        it('should fallback to default state on DB error', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
            db_1.prisma.botState.findUnique.mockRejectedValue(new Error('DB Connection Failed'));
            const state = await (0, state_1.loadState)();
            expect(state.lastProcessedPostUri).toBeNull();
            expect(state.lastProcessedAt).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });
    describe('saveState', () => {
        it('should upsert state to DB', async () => {
            const stateToSave = {
                lastProcessedPostUri: 'at://456',
                lastProcessedAt: '2026-07-17T03:00:00.000Z',
            };
            await (0, state_1.saveState)(stateToSave);
            expect(db_1.prisma.botState.upsert).toHaveBeenCalledWith({
                where: { id: 1 },
                update: {
                    lastProcessedPostUri: 'at://456',
                    lastProcessedAt: new Date('2026-07-17T03:00:00.000Z'),
                },
                create: {
                    id: 1,
                    lastProcessedPostUri: 'at://456',
                    lastProcessedAt: new Date('2026-07-17T03:00:00.000Z'),
                },
            });
        });
        it('should log an error if saving to DB fails', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
            db_1.prisma.botState.upsert.mockRejectedValue(new Error('Write Failed'));
            await (0, state_1.saveState)({ lastProcessedPostUri: null, lastProcessedAt: null });
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });
});
