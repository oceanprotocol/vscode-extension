#
# Copyright 2022 Ocean Protocol Foundation
# SPDX-License-Identifier: Apache-2.0
#
import pickle
import sys

import arff
import requests
import matplotlib
import numpy
from matplotlib import pyplot
from sklearn import gaussian_process

matplotlib.use("agg")


def branin_mesh(X0, X1):
    # b,c,t = 5.1/(4.*(pi)**2), 5./pi, 1./(8.*pi)
    b, c, t = 0.12918450914398066, 1.5915494309189535, 0.039788735772973836
    u = X1 - b * X0**2 + c * X0 - 6
    r = 10.0 * (1.0 - t) * numpy.cos(X0) + 10
    Z = u**2 + r

    return Z


def create_mesh(npoints):
    X0_vec = numpy.linspace(-5.0, 10.0, npoints)
    X1_vec = numpy.linspace(0.0, 15.0, npoints)
    X0, X1 = numpy.meshgrid(X0_vec, X1_vec)
    Z = branin_mesh(X0, X1)

    return X0, X1, Z


def get_input(dataset_url):
    response = requests.get(dataset_url, stream=True)  # Stream to handle large files
    response.raise_for_status()  # Check for errors

    # Extract filename from URL
    filename = dataset_url.split('/')[-1].split('?')[0]

    # Save the file locally
    with open(filename, 'wb') as file:
        for chunk in response.iter_content(chunk_size=8192):  
            file.write(chunk)

    print(f"File downloaded as: {filename}")

    return filename  


def plot(Zhat, npoints):
    X0, X1, Z = create_mesh(npoints)
    # plot data + model
    fig, ax = pyplot.subplots(subplot_kw={"projection": "3d"})
    ax.plot_wireframe(X0, X1, Z, linewidth=1)
    ax.scatter(X0, X1, Zhat, c="r", label="model")
    pyplot.title("Data + model")
    pyplot.show()


def run_gpr(local=False):
    npoints = 15

    filename = get_input('https://raw.githubusercontent.com/oceanprotocol/c2d-examples/refs/heads/main/branin_and_gpr/branin.arff')
    if not filename:
        print("Could not retrieve filename.")
        return

    with open(filename) as datafile:
        datafile.seek(0)
        res = arff.load(datafile)

    print("Stacking data.")
    mat = numpy.stack(res["data"])
    [X, y] = numpy.split(mat, [2], axis=1)

    print("Building Gaussian Process Regressor (GPR) model")
    model = gaussian_process.GaussianProcessRegressor()
    model.fit(X, y)
    yhat = model.predict(X, return_std=False)
    Zhat = numpy.reshape(yhat, (npoints, npoints))

    if local:
        print("Plotting results")
        plot(Zhat, npoints)

    filename = "gpr.pickle" if local else "/data/outputs/result"
    with open(filename, "wb") as pickle_file:
        print(f"Pickling results in {filename}")
        pickle.dump(Zhat, pickle_file)


if __name__ == "__main__":
    local = len(sys.argv) == 2 and sys.argv[1] == "local"
    run_gpr(local)