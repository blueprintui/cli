import { Alert } from 'library/alert';

customElements.get('bp-alert') || customElements.define('ui-alert', Alert);

declare global {
  interface HTMLElementTagNameMap {
    'ui-alert': Alert;
  }
}
