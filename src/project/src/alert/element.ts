import { html, LitElement } from 'lit';
import { property } from 'lit/decorators/property.js';
import styles from './element.css' assert { type: 'css' };

/**
 * @element ui-alert
 * @slot - alert content
 * @event - close
 * @cssprop --color
 */
export class Alert extends LitElement {
  static styles = [styles];

  @property({ type: String, reflect: true }) status: 'neutral' | 'success' | 'warning' | 'danger' = 'neutral';

  @property({ type: Boolean }) closable = false;

  render() {
    return html`
      <div class="private-host">
        <slot></slot>
        ${this.closable ? html`<button @click=${this.#close} part="close" aria-label="close">&times;</button>` : ''}
      </div>
    `;
  }

  #close() {
    this.dispatchEvent(new CustomEvent('close', { detail: true }));
  }
}
