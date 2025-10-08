// App.js
// Expo React Native app: "Break the 3C Cycle – Daily Reset"
// Fixed version — made storage robust (works on web with localStorage, native with AsyncStorage when available,
// and falls back to in-memory storage to avoid bundling/import errors).
// Also hardened Section to accept optional children and added small defensive checks.

import React, { useEffect, useState } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    Alert,
    StyleSheet,
    ScrollView,
} from 'react-native';

// NOTE: We avoid a static top-level `import AsyncStorage from '@react-native-async-storage/async-storage'`
// because some bundlers/environments (web preview, certain snack/embed systems) fail to resolve
// native-only packages. Instead we create a lightweight Storage wrapper that prefers:
// 1) window.localStorage when running on web,
// 2) the native AsyncStorage when available at runtime,
// 3) an in-memory fallback if neither are available.

const STORAGE_KEY = '@three_c_daily_entries_v1';

const Storage = (() => {
    // 1) Web/localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
        return {
            getItem: async (k) => {
                try {
                    return window.localStorage.getItem(k);
                } catch (e) {
                    console.warn('localStorage.getItem failed', e);
                    return null;
                }
            },
            setItem: async (k, v) => {
                try {
                    window.localStorage.setItem(k, v);
                } catch (e) {
                    console.warn('localStorage.setItem failed', e);
                }
            },
        };
    }

    // 2) Try to require native AsyncStorage at runtime (only executed where require is supported)
    try {
        // using require inside try so bundlers that resolve static imports for web don't choke
        // Note: Some bundlers still analyze require() calls, but this pattern avoids top-level import failures
        // in many embed environments.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AsyncStorageModule = require('@react-native-async-storage/async-storage');
        const AsyncStorage = AsyncStorageModule && (AsyncStorageModule.default || AsyncStorageModule);
        if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
            return AsyncStorage;
        }
    } catch (e) {
        // not available — we'll fall back to in-memory storage below
    }

    // 3) In-memory fallback (non-persistent) — safe default so the app still runs
    const mem = {};
    return {
        getItem: async (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
        setItem: async (k, v) => {
            mem[k] = v;
        },
    };
})();

function Section({ title, children = null }) {
    // children is optional — render if present
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children ?? null}
        </View>
    );
}

function SmallButton({ onPress, title }) {
    return (
        <TouchableOpacity onPress={onPress} style={styles.btn}>
            <Text style={styles.btnText}>{title}</Text>
        </TouchableOpacity>
    );
}

export default function App() {
    const todayKey = getTodayKey();
    const [entries, setEntries] = useState({});
    const [current, setCurrent] = useState(getEmptyEntry());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadEntries();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Whenever entries or loading or todayKey changes, ensure `current` represents today's entry
    useEffect(() => {
        if (!loading) {
            const saved = entries && entries[todayKey];
            if (saved && typeof saved === 'object') setCurrent(saved);
            else setCurrent(getEmptyEntry());
        }
    }, [loading, entries, todayKey]);

    async function loadEntries() {
        try {
            const raw = await Storage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            if (parsed && typeof parsed === 'object') setEntries(parsed);
            else setEntries({});
        } catch (e) {
            console.warn('Failed to load entries', e);
            setEntries({});
        } finally {
            setLoading(false);
        }
    }

    async function saveCurrent() {
        try {
            const updated = { ...entries, [todayKey]: current };
            await Storage.setItem(STORAGE_KEY, JSON.stringify(updated));
            setEntries(updated);
            Alert.alert('Saved', "Today's checklist was saved.");
        } catch (e) {
            console.warn('Save failed', e);
            Alert.alert('Error', 'Could not save.');
        }
    }

    function updateGratitude(index, text) {
        const g = Array.isArray(current?.morning?.gratitude) ? [...current.morning.gratitude] : ['', '', ''];
        g[index] = text;
        setCurrent({ ...current, morning: { ...current.morning, gratitude: g } });
    }

    function toggleMidC(idx) {
        const mid = { ...current.midday };
        const caught = Array.isArray(mid.caught) ? [...mid.caught] : [false, false, false];
        caught[idx] = !caught[idx];
        mid.caught = caught;
        setCurrent({ ...current, midday: mid });
    }

    function updateMidReframe(text) {
        setCurrent({ ...current, midday: { ...current.midday, reframe: text } });
    }

    function updateNightField(field, text) {
        setCurrent({ ...current, night: { ...current.night, [field]: text } });
    }

    function clearToday() {
        Alert.alert('Clear', "Clear today's entry?", [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const updated = { ...entries };
                        delete updated[todayKey];
                        await Storage.setItem(STORAGE_KEY, JSON.stringify(updated));
                        setEntries(updated);
                        setCurrent(getEmptyEntry());
                    } catch (e) {
                        console.warn('Clear failed', e);
                        Alert.alert('Error', 'Could not clear today.');
                    }
                },
            },
        ]);
    }

    function renderHistoryItem({ item }) {
        // defensive checks as saved data structure may be missing fields
        const key = item?.key ?? 'unknown';
        const value = item?.value ?? {};
        const morningGratitude = (value.morning && Array.isArray(value.morning.gratitude)) ? value.morning.gratitude : [];
        const morningCount = morningGratitude.filter(Boolean).length;
        const caught = (value.midday && Array.isArray(value.midday.caught)) ? value.midday.caught : [];
        const caughtCount = caught.filter(Boolean).length;
        const nightFilled = [value.night?.wentWell, value.night?.handled, value.night?.improve].filter(Boolean).length;

        return (
            <View style={styles.historyItem}>
                <Text style={styles.historyDate}>{key}</Text>
                <Text style={styles.historyMeta}>Gratitude: {morningCount} • Caught: {caughtCount} • Night: {nightFilled}</Text>
            </View>
        );
    }

    const historyArray = Object.keys(entries || {})
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 7)
        .map((k) => ({ key: k, value: entries[k] }));

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>Break the 3C Cycle — Daily Reset</Text>
                <Text style={styles.subtitle}>Date: {todayKey}</Text>

                <Section title="Morning — Gratitude (2 min)">
                    <Text style={styles.label}>List 3 things you're grateful for</Text>
                    {(current?.morning?.gratitude ?? ['','','']).map((g, i) => (
                        <TextInput
                            key={i}
                            value={g}
                            onChangeText={(t) => updateGratitude(i, t)}
                            placeholder={`Gratitude ${i + 1}`}
                            style={styles.input}
                        />
                    ))}
                </Section>

                <Section title="Midday — Awareness Check (1 min)">
                    <Text style={styles.label}>Did you notice any of these?</Text>
                    <View style={styles.rowWrap}>
                        {['Complaining', 'Comparing', 'Criticizing'].map((label, idx) => (
                            <TouchableOpacity
                                key={label}
                                style={[styles.checkbox, (current?.midday?.caught?.[idx]) && styles.checkboxOn]}
                                onPress={() => toggleMidC(idx)}
                            >
                                <Text style={styles.checkboxText}>{current?.midday?.caught?.[idx] ? '✓' : '+'}</Text>
                                <Text style={styles.checkboxLabel}>{label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={[styles.label, { marginTop: 8 }]}>Reframe / Note</Text>
                    <TextInput
                        value={current?.midday?.reframe ?? ''}
                        onChangeText={updateMidReframe}
                        placeholder="How can I reframe this?"
                        style={[styles.input, { height: 80 }]}
                        multiline
                    />
                </Section>

                <Section title="Night — Growth Reflection (2 min)">
                    <Text style={styles.label}>One thing that went well</Text>
                    <TextInput
                        value={current?.night?.wentWell ?? ''}
                        onChangeText={(t) => updateNightField('wentWell', t)}
                        placeholder="Went well..."
                        style={styles.input}
                    />
                    <Text style={styles.label}>One thing I handled better than before</Text>
                    <TextInput
                        value={current?.night?.handled ?? ''}
                        onChangeText={(t) => updateNightField('handled', t)}
                        placeholder="Handled better..."
                        style={styles.input}
                    />
                    <Text style={styles.label}>One thing to improve tomorrow</Text>
                    <TextInput
                        value={current?.night?.improve ?? ''}
                        onChangeText={(t) => updateNightField('improve', t)}
                        placeholder="Improve tomorrow..."
                        style={styles.input}
                    />
                </Section>

                <View style={styles.actionsRow}>
                    <SmallButton title="Save Today" onPress={saveCurrent} />
                    <SmallButton title="Clear Today" onPress={clearToday} />
                </View>

                <Section title="Last 7 days — Summary">
                    {historyArray.length === 0 ? (
                        <Text style={styles.muted}>No entries yet — they will appear here after you save.</Text>
                    ) : (
                        <FlatList data={historyArray} keyExtractor={(item) => item.key} renderItem={renderHistoryItem} />
                    )}
                </Section>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function getEmptyEntry() {
    return {
        morning: { gratitude: ['', '', ''] },
        midday: { caught: [false, false, false], reframe: '' },
        night: { wentWell: '', handled: '', improve: '' },
    };
}

function getTodayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    content: { padding: 16, paddingBottom: 40 },
    title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
    subtitle: { color: '#444', marginBottom: 12 },
    section: { marginVertical: 10, padding: 12, borderRadius: 8, backgroundColor: '#f7f7f8' },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
    label: { color: '#333', marginBottom: 6 },
    input: { backgroundColor: '#fff', borderColor: '#ddd', borderWidth: 1, borderRadius: 6, padding: 8, marginBottom: 8 },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap' },
    checkbox: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginRight: 8, marginBottom: 8 },
    checkboxOn: { backgroundColor: '#daf0da', borderColor: '#9ad49a' },
    checkboxText: { fontWeight: '700', width: 20, textAlign: 'center' },
    checkboxLabel: { marginLeft: 6 },
    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    btn: { backgroundColor: '#0b7cff', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginRight: 8 },
    btnText: { color: '#fff', fontWeight: '600' },
    historyItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
    historyDate: { fontWeight: '700' },
    historyMeta: { color: '#666' },
    muted: { color: '#666' },
});
