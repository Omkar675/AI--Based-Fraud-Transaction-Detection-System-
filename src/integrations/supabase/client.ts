// Mock Supabase client to prevent crashes since we are using local FastAPI backend

export const supabase = {
    from: (table: string) => ({
        select: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
            then: (cb: any) => cb({ data: [], error: null })
        }),
        insert: (data: any) => ({
            select: () => ({
                single: () => Promise.resolve({ data: { id: "mock-" + Date.now() }, error: null })
            }),
            then: (cb: any) => cb({ data: { id: "mock-" + Date.now() }, error: null })
        })
    }),
    channel: (name: string) => {
        const mockChannel = {
            on: (event: string, filter: any, callback: any) => mockChannel,
            subscribe: (cb?: (status: string) => void) => {
                if (cb) cb("SUBSCRIBED");
                return mockChannel;
            }
        };
        return mockChannel;
    },
    removeChannel: (channel: any) => { }
};
