/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview The interface for an object that supports a right-click.
 */

/**
 * The interface for an object that supports a right-click.
 * @namespace Blockly.IContextMenu
 */
import * as goog from '../../closure/goog/goog';
goog.declareModuleId('Blockly.IContextMenu');


/** @alias Blockly.IContextMenu */
export interface IContextMenu {
  /**
   * Show the context menu for this object.
   * @param e Mouse event.
   */
  showContextMenu: AnyDuringMigration;
}
