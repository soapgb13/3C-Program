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
    Modal,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HistoryTab from './components/HistoryTab';
import { Calendar } from 'react-native-calendars';
import TopBar from './components/TopBar';
import { SafeAreaView as SafeAreaViewRN } from 'react-native';
import { SafeAreaView as SafeAreaViewSA, useSafeAreaInsets } from 'react-native-safe-area-context';

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

function Section({ title, expanded, onToggle, children = null }) {
    return (
        <View style={styles.section}>
            <TouchableOpacity style={styles.sectionHeader} onPress={onToggle}>
                <Text style={styles.sectionTitle}>{title}</Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#333" />
            </TouchableOpacity>
            {expanded && (children ?? null)}
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

function Header() {
    return (
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Break the 3C Cycle — Daily Reset</Text>
        </View>
    );
}

function HistoryScreen({ entries }) {
    const historyArray = Object.keys(entries || {})
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 7)
        .map((k) => ({ key: k, value: entries[k] }));

    function renderHistoryItem({ item }) {
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

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <Header />
                <Section title="Last 7 days — Summary">
                    {historyArray.length === 0 ? (
                        <Text style={styles.muted}>No entries yet — they will appear here after you save.</Text>
                    ) : (
                        <FlatList data={historyArray} keyExtractor={(item) => item.key} renderItem={renderHistoryItem} />
                    )}
                </Section>
            </ScrollView>
        </SafeAreaView>
    );
}

function HomeScreen({ todayKey, current, updateGratitude, toggleMidC, updateMidReframe, updateNightField, clearToday, setTodayKey, setCurrent, entries, saveCurrent }) {
    const [calendarVisible, setCalendarVisible] = useState(false);
    const [expandedSections, setExpandedSections] = useState({ morning: true, midday: true, night: true });
    const handleToggleSection = (section) => {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };
    const handleDateSelect = (day) => {
        setTodayKey(day.dateString);
        if (entries[day.dateString] && typeof entries[day.dateString] === 'object') {
            setCurrent(entries[day.dateString]);
        } else {
            setCurrent(getEmptyEntry());
        }
        setCalendarVisible(false);
    };
    // Auto-save wrapper for field changes
    const autoSaveUpdateGratitude = (index, text) => {
        const g = Array.isArray(current?.morning?.gratitude) ? [...current.morning.gratitude] : ['', '', ''];
        g[index] = text;
        const updated = { ...current, morning: { ...current.morning, gratitude: g } };
        setCurrent(updated);
        saveCurrent(updated);
    };
    const autoSaveToggleMidC = (idx) => {
        const mid = { ...current.midday };
        const caught = Array.isArray(mid.caught) ? [...mid.caught] : [false, false, false];
        caught[idx] = !caught[idx];
        mid.caught = caught;
        const updated = { ...current, midday: mid };
        setCurrent(updated);
        saveCurrent(updated);
    };
    const autoSaveUpdateMidReframe = (text) => {
        const updated = { ...current, midday: { ...current.midday, reframe: text } };
        setCurrent(updated);
        saveCurrent(updated);
    };
    const autoSaveUpdateNightField = (field, text) => {
        const updated = { ...current, night: { ...current.night, [field]: text } };
        setCurrent(updated);
        saveCurrent(updated);
    };
    // Get today's date string
    const todayDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    const insets = useSafeAreaInsets();

    return (
        <SafeAreaViewSA style={{ flex: 1, paddingTop: insets.top }}>
            <TopBar
                date={formatDateString(todayKey)}
                onClear={clearToday}
                onDatePress={() => setCalendarVisible(true)}
            />
            <View style={{ marginTop: 60, flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <Modal
                        visible={calendarVisible}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setCalendarVisible(false)}
                    >
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#00000088' }}>
                            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 4 }}>
                                <Calendar
                                    onDayPress={handleDateSelect}
                                    markedDates={{ [todayKey]: { selected: true } }}
                                    initialDate={todayKey}
                                />
                                <TouchableOpacity onPress={() => setCalendarVisible(false)} style={{ marginTop: 12 }}>
                                    <Text style={{ color: '#0b7cff', textAlign: 'center' }}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                    <Section
                        title="Morning — Gratitude (2 min)"
                        expanded={expandedSections.morning}
                        onToggle={() => handleToggleSection('morning')}
                    >
                        <Text style={styles.label}>List 3 things you're grateful for</Text>
                        {(current?.morning?.gratitude ?? ['', '', '']).map((g, i) => (
                            <TextInput
                                key={i}
                                value={g}
                                onChangeText={(t) => autoSaveUpdateGratitude(i, t)}
                                placeholder={`Gratitude ${i + 1}`}
                                style={styles.input}
                                placeholderTextColor="#88888888"
                            />
                        ))}
                    </Section>
                    <Section
                        title="Midday — Awareness Check (1 min)"
                        expanded={expandedSections.midday}
                        onToggle={() => handleToggleSection('midday')}
                    >
                        <Text style={styles.label}>Did you notice any of these?</Text>
                        <View style={styles.rowWrap}>
                            {['Complaining', 'Comparing', 'Criticizing'].map((label, idx) => (
                                <TouchableOpacity
                                    key={label}
                                    style={[styles.checkbox, (current?.midday?.caught?.[idx]) && styles.checkboxOn]}
                                    onPress={() => autoSaveToggleMidC(idx)}
                                >
                                    <Text style={styles.checkboxText}>{current?.midday?.caught?.[idx] ? '✓' : '+'}</Text>
                                    <Text style={styles.checkboxLabel}>{label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={[styles.label, { marginTop: 8 }]}>Reframe / Note</Text>
                        <TextInput
                            value={current?.midday?.reframe ?? ''}
                            onChangeText={autoSaveUpdateMidReframe}
                            placeholder="How can I reframe this?"
                            style={[styles.input, { height: 80 }]}
                            multiline
                            placeholderTextColor="#88888888"
                        />
                    </Section>
                    <Section
                        title="Night — Growth Reflection (2 min)"
                        expanded={expandedSections.night}
                        onToggle={() => handleToggleSection('night')}
                    >
                        <Text style={styles.label}>One thing that went well</Text>
                        <TextInput
                            value={current?.night?.wentWell ?? ''}
                            onChangeText={(t) => autoSaveUpdateNightField('wentWell', t)}
                            placeholder="Went well..."
                            style={styles.input}
                            placeholderTextColor="#88888888"
                        />
                        <Text style={styles.label}>One thing I handled better than before</Text>
                        <TextInput
                            value={current?.night?.handled ?? ''}
                            onChangeText={(t) => autoSaveUpdateNightField('handled', t)}
                            placeholder="Handled better..."
                            style={styles.input}
                            placeholderTextColor="#88888888"
                        />
                        <Text style={styles.label}>One thing to improve tomorrow</Text>
                        <TextInput
                            value={current?.night?.improve ?? ''}
                            onChangeText={(t) => autoSaveUpdateNightField('improve', t)}
                            placeholder="Improve tomorrow..."
                            style={styles.input}
                            placeholderTextColor="#88888888"
                        />
                    </Section>
                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        </SafeAreaViewSA>
    );
}

const Tab = createBottomTabNavigator();

const HomeScreenWrapper = (props) => (
    <HomeScreen
        todayKey={props.todayKey}
        current={props.current}
        updateGratitude={props.updateGratitude}
        toggleMidC={props.toggleMidC}
        updateMidReframe={props.updateMidReframe}
        updateNightField={props.updateNightField}
        saveCurrent={props.saveCurrent}
        clearToday={props.clearToday}
    />
);

const HistoryScreenWrapper = (props) => (
    <HistoryScreen entries={props.entries} />
);

export default function App() {
    const [todayKey, setTodayKey] = useState(getTodayKey());
    const [entries, setEntries] = useState({});
    const [current, setCurrent] = useState(getEmptyEntry());
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadEntries(); }, []);
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

    async function saveCurrent(entryArg) {
        try {
            const entryToSave = entryArg || current;
            const updated = { ...entries, [todayKey]: entryToSave };
            await Storage.setItem(STORAGE_KEY, JSON.stringify(updated));
            setEntries(updated);
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
        // Immediately reset UI
        setCurrent(getEmptyEntry());
        // Remove today's entry from storage
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
                        setCurrent(getEmptyEntry()); // Ensure UI clears immediately
                    } catch (e) {
                        console.warn('Clear failed', e);
                        Alert.alert('Error', 'Could not clear today.');
                    }
                },
            },
        ]);
    }

    if (loading) return <View style={styles.container}><Text>Loading...</Text></View>;

    return (
        <NavigationContainer>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    tabBarIcon: ({ color, size }) => {
                        let iconName;
                        if (route.name === 'Home') iconName = 'home';
                        else if (route.name === 'History') iconName = 'calendar';
                        return <Ionicons name={iconName} size={size} color={color} />;
                    },
                    tabBarActiveTintColor: '#0b7cff',
                    tabBarInactiveTintColor: '#888',
                    headerShown: false,
                })}
            >
                <Tab.Screen
                    name="Home"
                    options={{
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="home" color={color} size={size} />
                        ),
                    }}
                >
                    {() => (
                        <HomeScreen
                            todayKey={todayKey}
                            current={current}
                            updateGratitude={updateGratitude}
                            toggleMidC={toggleMidC}
                            updateMidReframe={updateMidReframe}
                            updateNightField={updateNightField}
                            saveCurrent={saveCurrent}
                            clearToday={clearToday}
                            setTodayKey={setTodayKey}
                            setCurrent={setCurrent}
                            entries={entries}
                        />
                    )}
                </Tab.Screen>
                <Tab.Screen
                    name="History"
                    options={{
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="calendar" color={color} size={size} />
                        ),
                    }}
                >
                    {() => <HistoryTab entries={entries} />}
                </Tab.Screen>
            </Tab.Navigator>
        </NavigationContainer>
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

function formatDateString(dateStr) {
    // dateStr: 'YYYY-MM-DD'
    const [year, month, day] = dateStr.split('-');
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = months[parseInt(month, 10) - 1];
    return `${monthName} ${parseInt(day, 10)}, ${year}`;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        backgroundColor: '#0b7cff',
        paddingVertical: 24,
        paddingHorizontal: 16,
        alignItems: 'center',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        marginBottom: 8,
        boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', // modern shadow property
    },
    headerTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    content: { padding: 16, paddingBottom: 40 },
    title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
    subtitle: { color: '#444', marginBottom: 12 },
    section: { marginVertical: 10, padding: 12, borderRadius: 8, backgroundColor: '#f7f7f8' },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
        paddingHorizontal: 2,
        marginBottom: 4,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
    label: { color: '#333', marginBottom: 6 },
    input: { backgroundColor: '#fff', borderColor: '#ddd', borderWidth: 1, borderRadius: 6, padding: 8, marginBottom: 8 },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap' },
    checkbox: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginRight: 8, marginBottom: 8 },
    checkboxOn: { backgroundColor: '#daf0da', borderColor: '#9ad49a' },
    checkboxText: { fontWeight: '700', width: 20, textAlign: 'center' },
    checkboxLabel: { marginLeft: 6 },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        justifyContent: 'flex-start',
    },
    iconButtonRow: {
        flexDirection: 'row',
        marginLeft: 12,
        alignItems: 'center',
    },
    iconButton: {
        backgroundColor: '#f7f7f8',
        borderRadius: 16,
        padding: 8,
        marginLeft: 6,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btn: { backgroundColor: '#0b7cff', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginRight: 8 },
    btnText: { color: '#fff', fontWeight: '600' },
    historyItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
    historyDate: { fontWeight: '700' },
    historyMeta: { color: '#666' },
    muted: { color: '#666' },
    dateButton: {
        backgroundColor: '#eaf4ff',
        borderColor: '#0b7cff',
        borderWidth: 1,
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 18,
        alignSelf: 'flex-start',
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateButtonText: {
        color: '#0b7cff',
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 0.5,
    },
});
