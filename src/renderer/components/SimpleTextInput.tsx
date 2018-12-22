import * as React from 'react';


export default class SimpleTextInput extends React.Component {
  readonly props: {
    label: string,
    value: string,
    onChange: (value: string) => void
  };

  render() {
    return (
      <div className="SimpleTextInput">
        <label>{this.props.label}</label>
        <input
          type="text"
          value={this.props.value}
          onChange={this.onChange.bind(this)}>
        </input>
      </div>
    );
  }

  onChange(e: React.FormEvent<HTMLSelectElement>) {
    this.props.onChange(e.currentTarget.value);
  }
}
