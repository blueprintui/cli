import { Alert } from '../alert/index.js';

customElements.get('ui-alert') || customElements.define('ui-alert', Alert);

declare global {
  interface HTMLElementTagNameMap {
    'ui-alert': Alert;
  }
}