import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';

import { Widget } from '@lumino/widgets';

/**
 * Initialization data for the jupyterlab_bsshconn extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_bsshconn:plugin',
  description: 'A JupyterLab extension for ssh connections.',
  autoStart: true,
  optional: [ISettingRegistry],
  requires: [ICommandPalette],
  activate: (app: JupyterFrontEnd, palette: ICommandPalette, settingRegistry: ISettingRegistry | null) => {
    console.log('JupyterLab extension jupyterlab_bsshconn is activated!');
    console.log('ICommandPalette:', palette);

    // Define a widget creator function,
    // then call it to make a new widget
    const newWidget = () => {
      // Create a blank content widget inside of a MainAreaWidget
      const content = new Widget();
      const widget = new MainAreaWidget({ content });
      widget.id = 'bsshconn-jupyterlab';
      widget.title.label = 'SSH connection';
      widget.title.closable = true;
      return widget;
    }
    let widget = newWidget();

    // Add an application command
    const command: string = 'bsshconn:open';
    app.commands.addCommand(command, {
      label: 'SSH connection',
      execute: () => {
        // Regenerate the widget if disposed
        if (widget.isDisposed) {
          widget = newWidget();
        }
        if (!widget.isAttached) {
          // Attach the widget to the main work area if it's not there
          app.shell.add(widget, 'main');
        }
        // Activate the widget
        app.shell.activateById(widget.id);
      }
    });

    // Add the command to the palette.
    palette.addItem({ command, category: 'Tutorial' });
      
    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('jupyterlab_bsshconn settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for jupyterlab_bsshconn.', reason);
        });
    }
  }
};

export default plugin;
