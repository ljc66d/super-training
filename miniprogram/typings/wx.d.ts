/**
 * 微信小程序全局 API 类型声明（精简版）
 * 完整类型可安装 miniprogram-api-typings 获得，此处保证 tsc 可编译通过。
 */

declare const wx: any;
declare function getApp<T = any>(): T;
declare function getCurrentPages(): any[];
declare function Page(options: any): void;
declare function Component(options: any): void;
declare function App(options: any): void;
declare function requirePlugin(name: string): any;

declare module '*.json' {
  const value: any;
  export default value;
}
