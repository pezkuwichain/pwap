declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import { Component } from 'react';
  export default class Icon extends Component<{ name: string; size?: number; color?: string; style?: any }> {}
}

declare module 'react-native-image-picker' {
  export interface ImagePickerResponse {
    assets?: Array<{ uri?: string; fileName?: string; type?: string }>;
    didCancel?: boolean;
    errorCode?: string;
  }
  export function launchImageLibrary(options: any, callback?: (response: ImagePickerResponse) => void): Promise<ImagePickerResponse>;
}
