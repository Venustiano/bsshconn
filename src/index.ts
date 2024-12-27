import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';

import { Widget } from '@lumino/widgets';
import { Terminal } from '@jupyterlab/terminal';
import { TerminalManager } from '@jupyterlab/services';

/**
 * Initialization data for the jupyterlab_bsshconn extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_bsshconn:plugin',
  description: 'A JupyterLab extension for SSH connections.',
  autoStart: true,
  optional: [ISettingRegistry],
  requires: [ICommandPalette],
  activate: async (app: JupyterFrontEnd, palette: ICommandPalette, settingRegistry: ISettingRegistry | null) => {
    console.log('JupyterLab extension jupyterlab_bsshconn is activated!');
    console.log('ICommandPalette:', palette);

    // Define a widget creator function,
    // then call it to make a new widget
    const newWidget = () => {
      // Create a content widget with a form for SSH connection
      const content = new Widget();
      content.node.innerHTML = `
        <div style="padding: 20px;">
          <h2>SSH Connection</h2>
          <form id="ssh-form">
            <div style="margin-bottom: 10px;">
              <label for="username">Username:</label>
              <input type="text" id="username" name="username" style="width: 50%; padding: 8px;">
            </div>
            <div style="margin-bottom: 10px;">
              <label for="host">Host:</label>
              <input type=\"text\" id=\"host\" name=\"host\" value=\"login1.hb.hpc.rug.nl\" placeholder=\"e.g., login1.hb.hpc.rug.nl\" style="width: 50%; padding: 8px;">
            </div>
            </div>
            <div style="margin-bottom: 10px;">
              <label for="password">Password:</label>
              <input type="password" id="password" name="password" style="width: 50%; padding: 8px;">
            </div>
            <div style="margin-bottom: 10px;">
              <label for="2fa">2FA Code:</label>
              <input type="text" id="twofa" name="twofa" style="width: 50%; padding: 8px;">
            </div>
            <button type="button" id="connect-button" style="padding: 10px 20px;">Connect</button>
          </form>
        </div>
      `;

      // Add event listener for the Connect button
      const connectButton = content.node.querySelector('#connect-button') as HTMLButtonElement;
      connectButton?.addEventListener('click', async () => {
        const username = (content.node.querySelector('#username') as HTMLInputElement).value;
        const host = (content.node.querySelector('#host') as HTMLInputElement).value;
        const password = (content.node.querySelector('#password') as HTMLInputElement).value;
        const twoFactorCode = (content.node.querySelector('#twofa') as HTMLInputElement).value;

        if (!username || !host || !password || !twoFactorCode) {
          alert('Please fill in all fields.');
          return;
        }

        try {

            const terminalManager = new TerminalManager();
            const terminalConnection = await terminalManager.startNew();
            // Create a new terminal session using the terminal manager
          //const session = await app.serviceManager.terminals.startNew();
          // Create a new terminal session with a specific path
          //const session = await TerminalSession.startNew();

         
          // Create a new terminal session
          const terminal = new Terminal(
              terminalConnection
          );
          app.shell.add(terminal, 'main');
          app.shell.activateById(terminal.id);

          // if (!terminalWidget) {
          //   alert('Failed to start a terminal session.');
          //   return;
          // }

          // Simulate the SSH connection process
          terminal.session.send({ type: 'stdin', content: [`ssh ${username}@${host}\n`] });
          setTimeout(() => {
            terminal.session.send({ type: 'stdin', content: [`${password}\n`] });
          }, 2000);
          setTimeout(() => {
            terminal.session.send({ type: 'stdin', content: [`${twoFactorCode}\n`] });
          }, 4000);

          alert('Attempting SSH connection... Check the terminal for progress.');
        } catch (error) {
          console.error('Failed to establish an SSH connection:', error);
          alert('Failed to establish an SSH connection. See the console for details.');
        }
      });

      const widget = new MainAreaWidget({ content });
      widget.id = 'bsshconn-jupyterlab';
      widget.title.label = 'SSH Connection';
      widget.title.closable = true;

      return widget;
    };

    let widget = newWidget();

    // Add an application command
    const command: string = 'bsshconn:open';
    app.commands.addCommand(command, {
      label: 'SSH Connection',
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
