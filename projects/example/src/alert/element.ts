import { html, LitElement } from 'lit';
import { property } from 'lit/decorators/property.js';
import styles from './element.css' with { type: 'css' };

/**
 * @element ui-alert
 * @slot - alert content
 * @event close
 * @command close - close the alert
 * @cssprop --color
 */
export class Alert extends LitElement {
  static styles = [styles];

  @property({ type: String, reflect: true }) accessor status: 'neutral' | 'success' | 'warning' | 'danger' = 'neutral';

  @property({ type: Boolean }) accessor closable = false;

  render() {
    return html`
      <div class="private-host">
        <slot></slot>
        ${this.closable ? html`<button @click=${this.#close} part="close" aria-label="close">&times;</button>` : ''}
      </div>
    `;
  }

  constructor() {
    super();
    this.addEventListener('--close', event => {
      console.log(event as CommandEvent);
      this.#close();
    });
  }

  #close() {
    this.dispatchEvent(new CustomEvent('close', { detail: true }));
  }
}
