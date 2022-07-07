/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Contains functions registering serializers (eg blocks,
 * variables, plugins, etc).
 */

/**
 * Contains functions registering serializers (eg blocks, variables, plugins,
 * etc).
 * @namespace Blockly.serialization.registry
 */
import * as goog from '../../closure/goog/goog';
goog.declareModuleId('Blockly.serialization.registry');

// eslint-disable-next-line no-unused-vars
import {ISerializer} from '../interfaces/i_serializer';
import * as registry from '../registry';


/**
 * Registers the given serializer so that it can be used for serialization and
 * deserialization.
 * @param name The name of the serializer to register.
 * @param serializer The serializer to register.
 * @alias Blockly.serialization.registry.register
 */
export function register(name: string, serializer: ISerializer) {
  registry.register(registry.Type.SERIALIZER, name, serializer);
}

/**
 * Unregisters the serializer associated with the given name.
 * @param name The name of the serializer to unregister.
 * @alias Blockly.serialization.registry.unregister
 */
export function unregister(name: string) {
  registry.unregister(registry.Type.SERIALIZER, name);
}
