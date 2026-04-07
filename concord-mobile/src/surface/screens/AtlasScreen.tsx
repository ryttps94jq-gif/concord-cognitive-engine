// Concord Mobile — Atlas Screen
// Map view of Foundation data and signal visualization

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLatticeStore } from '../../store/lattice-store';
import { DTU_TYPES } from '../../utils/constants';

// Base URL for the Concord backend. Override with EXPO_PUBLIC_API_URL in .env.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5050';

interface SenseReading {
  id?: string;
  type?: string;
  sensor?: string;
  value?: number | string;
  unit?: string;
  timestamp?: number | string;
  tags?: string[];
  [key: string]: unknown;
}

interface AtlasLiveData {
  signals?: Array<{ id?: string; type?: string; strength?: number; timestamp?: number | string; [key: string]: unknown }>;
  coverage?: number;
  activeNodes?: number;
  [key: string]: unknown;
}

export function AtlasScreen() {
  const getDTUsByType = useLatticeStore(s => s.getDTUsByType);
  const foundationDTUs = getDTUsByType(DTU_TYPES.FOUNDATION_SENSE);
  const sensorDTUs = getDTUsByType(DTU_TYPES.SENSOR_READING);
  const signalDTUs = getDTUsByType(DTU_TYPES.ATLAS_SIGNAL);

  const totalReadings = foundationDTUs.length + sensorDTUs.length;

  // Remote data from backend
  const [senseReadings, setSenseReadings] = useState<SenseReading[]>([]);
  const [liveData, setLiveData] = useState<AtlasLiveData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  const fetchAtlasData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [readingsRes, liveRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/foundation/sense/readings?limit=20`),
        fetch(`${API_BASE_URL}/api/atlas/live`),
      ]);

      if (readingsRes.ok) {
        const readingsData = await readingsRes.json();
        // Accept either a top-level array or a { readings: [...] } envelope
        const readings: SenseReading[] = Array.isArray(readingsData)
          ? readingsData
          : (readingsData.readings ?? readingsData.data ?? []);
        setSenseReadings(readings);
      }

      if (liveRes.ok) {
        const live = await liveRes.json();
        setLiveData(live);
      }

      setLastFetchedAt(Date.now());
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAtlasData();
  }, [fetchAtlasData]);

  // Merge local DTU readings with remote API readings for display
  const localReadingItems = foundationDTUs.slice(0, 10).map(dtu => ({
    id: dtu.id,
    label: dtu.tags[0] || 'sensor',
    timestamp: dtu.header.timestamp,
    source: 'local' as const,
  }));

  const remoteReadingItems = senseReadings.slice(0, 10).map((r, i) => ({
    id: r.id ?? `remote_${i}`,
    label: r.type ?? r.sensor ?? (r.tags?.[0]) ?? 'sensor',
    timestamp: typeof r.timestamp === 'number' ? r.timestamp : Date.parse(String(r.timestamp ?? '')),
    source: 'server' as const,
  }));

  // Prefer remote data if available, else show local DTUs
  const readingItems = remoteReadingItems.length > 0 ? remoteReadingItems : localReadingItems;
  const hasAnyData = readingItems.length > 0 || (liveData !== null);

  const remoteSignalCount = liveData?.signals?.length ?? signalDTUs.length;
  const totalReadingCount = remoteReadingItems.length > 0
    ? remoteReadingItems.length
    : totalReadings;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Atlas</Text>
        <Text style={styles.headerSubtitle}>Foundation Sense Visualization</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalReadingCount}</Text>
          <Text style={styles.statLabel}>Sensor Readings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{remoteSignalCount}</Text>
          <Text style={styles.statLabel}>Atlas Signals</Text>
        </View>
        {liveData?.activeNodes != null && (
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{liveData.activeNodes}</Text>
            <Text style={styles.statLabel}>Active Nodes</Text>
          </View>
        )}
      </View>

      {/* Live Atlas summary from backend */}
      {liveData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Network</Text>
          <View style={styles.liveCard}>
            {liveData.coverage != null && (
              <View style={styles.liveRow}>
                <Text style={styles.liveLabel}>Coverage</Text>
                <Text style={styles.liveValue}>{liveData.coverage}%</Text>
              </View>
            )}
            {(liveData.signals ?? []).slice(0, 5).map((sig, i) => (
              <View key={sig.id ?? i} style={styles.liveRow}>
                <Text style={styles.liveLabel}>{sig.type ?? `Signal ${i + 1}`}</Text>
                {sig.strength != null && (
                  <Text style={styles.liveValue}>{sig.strength} dBm</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Sensor Readings</Text>
          <TouchableOpacity onPress={fetchAtlasData} disabled={isLoading} style={styles.refreshButton}>
            {isLoading
              ? <ActivityIndicator size="small" color="#00d4ff" />
              : <Text style={styles.refreshText}>Refresh</Text>
            }
          </TouchableOpacity>
        </View>

        {lastFetchedAt && (
          <Text style={styles.fetchedAt}>
            Updated {new Date(lastFetchedAt).toLocaleTimeString()}
          </Text>
        )}

        {fetchError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>Could not reach server: {fetchError}</Text>
          </View>
        )}

        {hasAnyData ? (
          readingItems.map(item => (
            <View key={item.id} style={styles.readingRow}>
              <View style={styles.readingLeft}>
                <Text style={styles.readingType}>{item.label}</Text>
                <Text style={styles.readingSource}>{item.source}</Text>
              </View>
              <Text style={styles.readingTime}>
                {isNaN(item.timestamp) ? '—' : new Date(item.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          ))
        ) : (
          !isLoading && (
            <Text style={styles.emptyText}>
              {fetchError ? 'Showing local data only — no local readings yet' : 'No Foundation Sense data yet'}
            </Text>
          )
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  headerTitle: { color: '#00d4ff', fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: '#888', fontSize: 12, marginTop: 4 },
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: {
    flex: 1, backgroundColor: '#14141f', borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#1a1a2e',
  },
  statValue: { color: '#00d4ff', fontSize: 28, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 4 },
  section: { padding: 16, borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#e0e0e0', fontSize: 16, fontWeight: '600' },
  refreshButton: { paddingHorizontal: 8, paddingVertical: 4 },
  refreshText: { color: '#00d4ff', fontSize: 13 },
  fetchedAt: { color: '#555', fontSize: 11, marginBottom: 10 },
  liveCard: {
    backgroundColor: '#14141f', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#1a3a5c',
  },
  liveRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  liveLabel: { color: '#aaa', fontSize: 13 },
  liveValue: { color: '#00d4ff', fontSize: 13, fontWeight: '600' },
  errorBanner: {
    backgroundColor: '#2a1a1a', borderRadius: 8, padding: 10, marginBottom: 10,
    borderWidth: 1, borderColor: '#5c1a1a',
  },
  errorText: { color: '#ff6b6b', fontSize: 12 },
  readingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#14141f',
  },
  readingLeft: { flex: 1 },
  readingType: { color: '#e0e0e0', fontSize: 14, textTransform: 'capitalize' },
  readingSource: { color: '#555', fontSize: 10, marginTop: 2 },
  readingTime: { color: '#888', fontSize: 12 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
});
