import { FreshApp } from '../fresh/FreshApp';
import './modern.css';
export function ModernApp({ token }: { token: string }) { return <FreshApp token={token} appearance="modern" />; }
