import { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, PermissionsAndroid, Platform, StyleSheet } from 'react-native';
import { BleManager, Characteristic, Device, Service, Subscription } from 'react-native-ble-plx';
import { atob } from 'react-native';

const manager = new BleManager();

type CharEntry = { serviceUUID: string; char: Characteristic };

export default function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [chars, setChars] = useState<CharEntry[]>([]);
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const subscriptions = useRef<Subscription[]>([]);

  useEffect(() => {
    requestPermissions().then(startScan);
    return () => {
      manager.stopDeviceScan();
      subscriptions.current.forEach(s => s.remove());
      connectedDevice?.cancelConnection();
    };
  }, []);

  function startScan() {
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) { console.error(error); return; }
      if (device?.name) {
        setDevices(prev => prev.find(d => d.id === device.id) ? prev : [...prev, device]);
      }
    });
  }

  async function connectToDevice(device: Device) {
    try {
      manager.stopDeviceScan();
      setStatus(`Подключение к ${device.name}...`);
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connected);
      setStatus(`Подключено: ${connected.name}`);
      await loadCharacteristics(connected);
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    }
  }

  async function loadCharacteristics(device: Device) {
    const services: Service[] = await device.services();
    const entries: CharEntry[] = [];
    for (const service of services) {
      const characteristics = await service.characteristics();
      for (const char of characteristics) {
        entries.push({ serviceUUID: service.uuid, char });
      }
    }
    setChars(entries);
  }

  async function readCharacteristic(entry: CharEntry) {
    try {
      const result = await entry.char.read();
      const value = result.value ? decodeBase64(result.value) : '(пусто)';
      setReadings(prev => ({ ...prev, [entry.char.uuid]: value }));
    } catch (e) {
      setReadings(prev => ({ ...prev, [entry.char.uuid]: `Ошибка: ${(e as Error).message}` }));
    }
  }

  function subscribeCharacteristic(entry: CharEntry) {
    const sub = entry.char.monitor((error, char) => {
      if (error) { console.error(error); return; }
      const value = char?.value ? decodeBase64(char.value) : '(пусто)';
      setReadings(prev => ({ ...prev, [entry.char.uuid]: value }));
    });
    subscriptions.current.push(sub);
    setReadings(prev => ({ ...prev, [entry.char.uuid]: 'Ожидание уведомлений...' }));
  }

  async function disconnect() {
    subscriptions.current.forEach(s => s.remove());
    subscriptions.current = [];
    await connectedDevice?.cancelConnection();
    setConnectedDevice(null);
    setChars([]);
    setReadings({});
    setStatus('Отключено');
    startScan();
  }

  if (connectedDevice) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.heading}>{connectedDevice.name}</Text>
        <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}>
          <Text style={styles.btnText}>Отключиться</Text>
        </TouchableOpacity>
        {chars.map(entry => (
          <View key={entry.char.uuid} style={styles.charItem}>
            <Text style={styles.charUuid} numberOfLines={1}>{entry.char.uuid}</Text>
            <Text style={styles.charProps}>
              {entry.char.isReadable ? 'READ ' : ''}
              {entry.char.isNotifiable || entry.char.isIndicatable ? 'NOTIFY ' : ''}
              {entry.char.isWritableWithResponse || entry.char.isWritableWithoutResponse ? 'WRITE' : ''}
            </Text>
            {readings[entry.char.uuid] != null && (
              <Text style={styles.charValue}>{readings[entry.char.uuid]}</Text>
            )}
            <View style={styles.charActions}>
              {entry.char.isReadable && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => readCharacteristic(entry)}>
                  <Text style={styles.btnText}>Читать</Text>
                </TouchableOpacity>
              )}
              {(entry.char.isNotifiable || entry.char.isIndicatable) && (
                <TouchableOpacity style={[styles.actionBtn, styles.notifyBtn]} onPress={() => subscribeCharacteristic(entry)}>
                  <Text style={styles.btnText}>Подписаться</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{status || `Найдено устройств: ${devices.length}`}</Text>
      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.deviceItem} onPress={() => connectToDevice(item)}>
            <Text style={styles.deviceName}>{item.name}</Text>
            <Text style={styles.deviceId}>{item.id}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function decodeBase64(b64: string): string {
  try {
    const binary = atob(b64);
    // попытка прочитать как UTF-8 текст
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return b64;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 40 },
  heading: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  status: { marginBottom: 12, fontSize: 16 },
  deviceItem: { padding: 12, marginBottom: 8, backgroundColor: '#e8f4fd', borderRadius: 8 },
  deviceName: { fontSize: 16, fontWeight: 'bold' },
  deviceId: { fontSize: 12, color: '#666' },
  charItem: { padding: 12, marginBottom: 8, backgroundColor: '#f0f0f0', borderRadius: 8 },
  charUuid: { fontSize: 11, color: '#444', marginBottom: 2 },
  charProps: { fontSize: 12, color: '#0066cc', marginBottom: 4 },
  charValue: { fontSize: 14, backgroundColor: '#fff', padding: 6, borderRadius: 4, marginBottom: 6 },
  charActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 8, backgroundColor: '#0066cc', borderRadius: 6 },
  notifyBtn: { backgroundColor: '#00884d' },
  disconnectBtn: { padding: 12, backgroundColor: '#ff4444', borderRadius: 8, marginBottom: 16 },
  btnText: { color: '#fff', fontWeight: 'bold' },
});

async function requestPermissions() {
  if (Platform.OS === 'android') {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
  }
}