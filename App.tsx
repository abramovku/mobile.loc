import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, PermissionsAndroid, Platform, StyleSheet } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';

const manager = new BleManager();

export default function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    requestPermissions().then(() => {
      manager.startDeviceScan(null, null, (error, device) => {
        if (error) { console.error(error); return; }
        if (device && device.name) {
          setDevices(prev =>
            prev.find(d => d.id === device.id) ? prev : [...prev, device]
          );
        }
      });
    });
    return () => {
      manager.stopDeviceScan();
      connectedDevice?.cancelConnection();
    };
  }, []);

  async function connectToDevice(device: Device) {
    try {
      manager.stopDeviceScan();
      setStatus(`Подключение к ${device.name}...`);
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connected);
      setStatus(`Подключено: ${connected.name}`);
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    }
  }

  async function disconnect() {
    if (!connectedDevice) return;
    await connectedDevice.cancelConnection();
    setConnectedDevice(null);
    setStatus('Отключено');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{status || `Найдено устройств: ${devices.length}`}</Text>
      {connectedDevice && (
        <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}>
          <Text style={styles.btnText}>Отключиться</Text>
        </TouchableOpacity>
      )}
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 50 },
  status: { marginBottom: 12, fontSize: 16 },
  deviceItem: { padding: 12, marginBottom: 8, backgroundColor: '#e8f4fd', borderRadius: 8 },
  deviceName: { fontSize: 16, fontWeight: 'bold' },
  deviceId: { fontSize: 12, color: '#666' },
  disconnectBtn: { padding: 12, backgroundColor: '#ff4444', borderRadius: 8, marginBottom: 12 },
  btnText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
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