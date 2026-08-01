import React from 'react';
import { renderToString } from 'react-dom/server';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { Switch, Route } from 'wouter';

function PR({ component: Component, path }) {
  return (
    <Route path={path}>
      <Component />
    </Route>
  );
}

function App() {
  return (
    <Router hook={memoryLocation({ path: '/superadmin' })[0]}>
      <Switch>
        <PR path="/superadmin" component={() => <div>SUPERADMIN</div>} />
        <PR path="/" component={() => <div>DASHBOARD</div>} />
        <Route component={() => <div>NOT FOUND</div>} />
      </Switch>
    </Router>
  );
}

console.log(renderToString(<App />));
