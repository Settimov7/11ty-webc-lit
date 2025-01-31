import { LitElement, html } from 'lit';

import styles from './component.css';

class GreetingComponent extends LitElement {
	static properties = {
		name: { type: String }
	};

	static get styles() {
		return [styles];
	}

	constructor() {
		super();
		this.name = 'World';
	}

	render() {
		return html`<p>Hello, ${this.name}!</p>`;
	}
}

customElements.define('greeting-component', GreetingComponent);
