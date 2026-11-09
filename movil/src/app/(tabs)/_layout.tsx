import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { color } from '../../lib/tema';

/** Barra de pestañas de abajo, nativa: en iOS con efecto cristal y en Android con Material 3. */
export default function Pestanas() {
  return (
    <NativeTabs tintColor={color.acento} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="averias">
        <NativeTabs.Trigger.Icon sf={{ default: 'wrench.and.screwdriver', selected: 'wrench.and.screwdriver.fill' }} md="build" />
        <NativeTabs.Trigger.Label>Averías</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }} md="forum" />
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="historial">
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" md="history" />
        <NativeTabs.Trigger.Label>Historial</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
