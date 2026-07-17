"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../src/config");
const db_1 = require("../src/db");
jest.mock('../src/db', () => ({
    prisma: {
        config: {
            findUnique: jest.fn(),
            create: jest.fn(),
            upsert: jest.fn(),
        },
    },
}));
describe('config.ts Unit Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('getSettings', () => {
        it('should return settings from DB if they exist', async () => {
            const mockDbConfig = {
                id: 1,
                pollIntervalMinutes: 10,
                ignoreReplies: false,
                ignoreReposts: true,
                ignoreKeywords: ['ad'],
            };
            db_1.prisma.config.findUnique.mockResolvedValue(mockDbConfig);
            const settings = await (0, config_1.getSettings)();
            expect(db_1.prisma.config.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(settings).toEqual({
                pollIntervalMinutes: 10,
                ignoreReplies: false,
                ignoreReposts: true,
                ignoreKeywords: ['ad'],
            });
        });
        it('should create default settings in DB and return them if none exist', async () => {
            db_1.prisma.config.findUnique.mockResolvedValue(null);
            db_1.prisma.config.create.mockResolvedValue({});
            const settings = await (0, config_1.getSettings)();
            expect(db_1.prisma.config.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(db_1.prisma.config.create).toHaveBeenCalled();
            expect(settings.pollIntervalMinutes).toBe(5); // from env/default
            expect(settings.ignoreReplies).toBe(true);
            expect(settings.ignoreReposts).toBe(true);
            expect(settings.ignoreKeywords).toEqual([]);
        });
        it('should fallback to defaults on DB error', async () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
            db_1.prisma.config.findUnique.mockRejectedValue(new Error('Read error'));
            const settings = await (0, config_1.getSettings)();
            expect(settings.pollIntervalMinutes).toBe(5);
            expect(consoleWarnSpy).toHaveBeenCalled();
            consoleWarnSpy.mockRestore();
        });
    });
    describe('updateSettings', () => {
        it('should upsert updated configuration', async () => {
            const mockDbConfig = {
                id: 1,
                pollIntervalMinutes: 5,
                ignoreReplies: true,
                ignoreReposts: true,
                ignoreKeywords: [],
            };
            db_1.prisma.config.findUnique.mockResolvedValue(mockDbConfig);
            db_1.prisma.config.upsert.mockResolvedValue({});
            const updated = await (0, config_1.updateSettings)({ pollIntervalMinutes: 15, ignoreReplies: false });
            expect(db_1.prisma.config.upsert).toHaveBeenCalledWith({
                where: { id: 1 },
                update: {
                    pollIntervalMinutes: 15,
                    ignoreReplies: false,
                    ignoreReposts: true,
                    ignoreKeywords: [],
                },
                create: {
                    id: 1,
                    pollIntervalMinutes: 15,
                    ignoreReplies: false,
                    ignoreReposts: true,
                    ignoreKeywords: [],
                },
            });
            expect(updated.pollIntervalMinutes).toBe(15);
            expect(updated.ignoreReplies).toBe(false);
            expect(updated.ignoreReposts).toBe(true);
        });
    });
});
