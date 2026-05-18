import { useEffect, useState } from 'react';
import { View, Text, FlatList, PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';

const manager = new BleManager();

export default function App() {
  const [devices, setDevices] = useState<Device[]>([]);

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
    };
  }, []);

  return (
    <View style={{ flex: 1, padding: 50 }}>
      <Text>Найдено устройств: {devices.length}</Text>
      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <Text>{item.name} — {item.id}</Text>}
      />
    </View>
  );
}

async function requestPermissions() {
  if (Platform.OS === 'android') {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
  }
}